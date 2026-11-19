ALTER TABLE "event_registrations" ADD COLUMN "state" text DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "locale" text DEFAULT 'pl' NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_state_check" CHECK ("event_registrations"."state" IN ('registered', 'waitlisted'));--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_locale_check" CHECK ("event_registrations"."locale" IN ('pl', 'en'));--> statement-breakpoint
-- Only registrations in state 'registered' take a place. Lock first, then recount (see 0006).
CREATE OR REPLACE FUNCTION refresh_event_seat_count(target_event_id text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
	PERFORM 1 FROM event_seat_counts WHERE event_id = target_event_id FOR UPDATE;

	UPDATE event_seat_counts c
	SET
		max_seats = e.max_seats,
		seats_remaining = e.max_seats
			- (SELECT count(*) FROM event_registrations r WHERE r.event_id = e.id AND r.state = 'registered')
			- event_group_holds(e.id),
		updated_at = now()
	FROM events e
	WHERE c.event_id = target_event_id AND e.id = target_event_id;
END $$;
--> statement-breakpoint
DROP TRIGGER event_registrations_seat_count ON event_registrations;
--> statement-breakpoint
CREATE TRIGGER event_registrations_seat_count
AFTER INSERT OR DELETE OR UPDATE OF state ON event_registrations
FOR EACH ROW EXECUTE FUNCTION event_registrations_seat_count_trigger();
--> statement-breakpoint
CREATE INDEX event_registrations_waitlist_idx ON event_registrations (event_id, created_at) WHERE state = 'waitlisted';
