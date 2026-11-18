-- Group holds: places held by open registration groups count against event and
-- item capacity until confirmed (then they are real registrations) or released.
-- Recount functions keep the lock-first rule from 0006.

CREATE OR REPLACE FUNCTION group_deadline(target_event_id text)
RETURNS timestamptz LANGUAGE sql STABLE AS $$
	SELECT e.date - make_interval(hours => e.group_deadline_hours)
	FROM events e
	WHERE e.id = target_event_id
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION event_group_holds(target_event_id text)
RETURNS integer LANGUAGE sql STABLE AS $$
	SELECT COALESCE(sum(GREATEST(
		g.places - (
			SELECT count(*) FROM registration_group_members m
			WHERE m.group_id = g.id AND m.status = 'confirmed'
		),
		0
	)), 0)::int
	FROM registration_groups g
	WHERE g.event_id = target_event_id AND g.status = 'open'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION agenda_item_group_holds(target_item_id text)
RETURNS integer LANGUAGE sql STABLE AS $$
	SELECT COALESCE(sum(
		(
			SELECT count(*) FROM registration_group_members m
			JOIN registration_group_member_items mi ON mi.member_id = m.id
			WHERE m.group_id = g.id AND m.status = 'invited'
				AND mi.agenda_item_id = target_item_id
		)
		+ CASE WHEN EXISTS (
			SELECT 1 FROM registration_group_items gi
			WHERE gi.group_id = g.id AND gi.agenda_item_id = target_item_id
		) THEN GREATEST(
			g.places - (SELECT count(*) FROM registration_group_members m WHERE m.group_id = g.id),
			0
		) ELSE 0 END
	), 0)::int
	FROM registration_groups g
	JOIN agenda_items i ON i.event_id = g.event_id AND i.id = target_item_id
	WHERE g.status = 'open'
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_event_seat_count(target_event_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	PERFORM 1 FROM event_seat_counts WHERE event_id = target_event_id FOR UPDATE;

	UPDATE event_seat_counts c
	SET
		max_seats = e.max_seats,
		seats_remaining = e.max_seats
			- (SELECT count(*) FROM event_registrations r WHERE r.event_id = e.id)
			- event_group_holds(e.id),
		updated_at = now()
	FROM events e
	WHERE c.event_id = target_event_id AND e.id = target_event_id;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_agenda_item_seat_count(target_item_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	PERFORM 1 FROM agenda_item_seat_counts WHERE agenda_item_id = target_item_id FOR UPDATE;

	UPDATE agenda_item_seat_counts c
	SET
		max_seats = i.max_seats,
		registered_count = counts.n,
		seats_remaining = CASE
			WHEN i.max_seats IS NULL THEN NULL
			ELSE i.max_seats - counts.n - agenda_item_group_holds(i.id)
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

-- Event first, then items in id order (consistent lock order).
CREATE OR REPLACE FUNCTION refresh_event_and_item_seat_counts(target_event_id text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	item record;
BEGIN
	IF target_event_id IS NULL THEN
		RETURN;
	END IF;
	PERFORM refresh_event_seat_count(target_event_id);
	FOR item IN
		SELECT id FROM agenda_items WHERE event_id = target_event_id ORDER BY id
	LOOP
		PERFORM refresh_agenda_item_seat_count(item.id);
	END LOOP;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION registration_groups_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		PERFORM refresh_event_and_item_seat_counts(OLD.event_id);
	ELSE
		PERFORM refresh_event_and_item_seat_counts(NEW.event_id);
	END IF;
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER registration_groups_seat_count
AFTER INSERT OR DELETE OR UPDATE OF places, status ON registration_groups
FOR EACH ROW EXECUTE FUNCTION registration_groups_seat_count_trigger();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION registration_group_members_seat_count_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	target_group_id text;
BEGIN
	target_group_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.group_id ELSE NEW.group_id END;
	PERFORM refresh_event_and_item_seat_counts(
		(SELECT event_id FROM registration_groups WHERE id = target_group_id)
	);
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER registration_group_members_seat_count
AFTER INSERT OR DELETE OR UPDATE OF status ON registration_group_members
FOR EACH ROW EXECUTE FUNCTION registration_group_members_seat_count_trigger();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION group_item_links_seat_count_trigger()
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

CREATE TRIGGER registration_group_items_seat_count
AFTER INSERT OR DELETE ON registration_group_items
FOR EACH ROW EXECUTE FUNCTION group_item_links_seat_count_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_member_items_seat_count
AFTER INSERT OR DELETE ON registration_group_member_items
FOR EACH ROW EXECUTE FUNCTION group_item_links_seat_count_trigger();
