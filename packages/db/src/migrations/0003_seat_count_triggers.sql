-- Seat counts are derived from registration rows by triggers, so every writer
-- (app, admin, seed, future group holds) keeps them correct.

-- 1. Events that are already oversold: raise max_seats to the registered count.
DO $$
DECLARE
	oversold record;
BEGIN
	FOR oversold IN
		SELECT e.id, e.max_seats, c.n
		FROM events e
		JOIN (
			SELECT event_id, count(*)::int AS n
			FROM event_registrations
			GROUP BY event_id
		) c ON c.event_id = e.id
		WHERE c.n > e.max_seats
	LOOP
		RAISE NOTICE 'Event % was oversold (% registered, max %); raising max_seats.',
			oversold.id, oversold.n, oversold.max_seats;
		UPDATE events SET max_seats = oversold.n WHERE id = oversold.id;
	END LOOP;
END $$;
--> statement-breakpoint

-- 2. Backfill event_seat_counts from real registration counts.
INSERT INTO event_seat_counts (event_id, seats_remaining, max_seats, updated_at)
SELECT
	e.id,
	e.max_seats - (SELECT count(*) FROM event_registrations r WHERE r.event_id = e.id),
	e.max_seats,
	now()
FROM events e
ON CONFLICT (event_id) DO UPDATE SET
	seats_remaining = excluded.seats_remaining,
	max_seats = excluded.max_seats,
	updated_at = excluded.updated_at;
--> statement-breakpoint

-- 3. Capacity is enforced by the database.
ALTER TABLE event_seat_counts
	ADD CONSTRAINT event_seat_counts_seats_remaining_nonnegative
	CHECK (seats_remaining >= 0);
--> statement-breakpoint
ALTER TABLE agenda_item_seat_counts
	ADD CONSTRAINT agenda_item_seat_counts_seats_remaining_nonnegative
	CHECK (seats_remaining IS NULL OR seats_remaining >= 0);
--> statement-breakpoint

-- 4. Event counts.
CREATE OR REPLACE FUNCTION refresh_event_seat_count(target_event_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	UPDATE event_seat_counts c
	SET
		max_seats = e.max_seats,
		seats_remaining = e.max_seats
			- (SELECT count(*) FROM event_registrations r WHERE r.event_id = e.id),
		updated_at = now()
	FROM events e
	WHERE c.event_id = target_event_id AND e.id = target_event_id;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION events_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO event_seat_counts (event_id, seats_remaining, max_seats, updated_at)
	VALUES (NEW.id, NEW.max_seats, NEW.max_seats, now())
	ON CONFLICT (event_id) DO NOTHING;
	PERFORM refresh_event_seat_count(NEW.id);
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER events_seat_count
AFTER INSERT OR UPDATE OF max_seats ON events
FOR EACH ROW EXECUTE FUNCTION events_seat_count_trigger();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION event_registrations_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM refresh_event_seat_count(OLD.event_id);
	ELSE
		PERFORM refresh_event_seat_count(NEW.event_id);
	END IF;
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER event_registrations_seat_count
AFTER INSERT OR DELETE ON event_registrations
FOR EACH ROW EXECUTE FUNCTION event_registrations_seat_count_trigger();
--> statement-breakpoint

-- 5. Agenda item counts. max_seats NULL means no limit: seats_remaining NULL.
CREATE OR REPLACE FUNCTION refresh_agenda_item_seat_count(target_item_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	UPDATE agenda_item_seat_counts c
	SET
		max_seats = i.max_seats,
		registered_count = counts.n,
		seats_remaining = CASE
			WHEN i.max_seats IS NULL THEN NULL
			ELSE i.max_seats - counts.n
		END,
		updated_at = now()
	FROM agenda_items i,
		LATERAL (
			SELECT count(*)::int AS n
			FROM agenda_item_registrations r
			WHERE r.agenda_item_id = i.id
		) counts
	WHERE c.agenda_item_id = target_item_id AND i.id = target_item_id;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION agenda_items_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO agenda_item_seat_counts
		(agenda_item_id, event_id, max_seats, seats_remaining, registered_count, updated_at)
	VALUES (NEW.id, NEW.event_id, NEW.max_seats, NEW.max_seats, 0, now())
	ON CONFLICT (agenda_item_id) DO NOTHING;
	PERFORM refresh_agenda_item_seat_count(NEW.id);
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER agenda_items_seat_count
AFTER INSERT OR UPDATE OF max_seats ON agenda_items
FOR EACH ROW EXECUTE FUNCTION agenda_items_seat_count_trigger();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION agenda_item_registrations_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM refresh_agenda_item_seat_count(OLD.agenda_item_id);
	ELSE
		PERFORM refresh_agenda_item_seat_count(NEW.agenda_item_id);
	END IF;
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER agenda_item_registrations_seat_count
AFTER INSERT OR DELETE ON agenda_item_registrations
FOR EACH ROW EXECUTE FUNCTION agenda_item_registrations_seat_count_trigger();
