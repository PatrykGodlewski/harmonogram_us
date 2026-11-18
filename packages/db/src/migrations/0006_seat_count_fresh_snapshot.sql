-- Recount under the count-row lock with a fresh snapshot.
-- In READ COMMITTED, an UPDATE that waits for a row lock rechecks only the
-- target row: its count(*) subquery keeps the statement's old snapshot, so a
-- concurrent unregister + register could store a stale count. Lock first in
-- its own statement; the following UPDATE then takes a new snapshot.

CREATE OR REPLACE FUNCTION refresh_event_seat_count(target_event_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	PERFORM 1 FROM event_seat_counts WHERE event_id = target_event_id FOR UPDATE;

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
