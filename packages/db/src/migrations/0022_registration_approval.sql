ALTER TABLE "event_registrations" DROP CONSTRAINT "event_registrations_state_check";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "requires_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_state_check" CHECK ("event_registrations"."state" IN ('registered', 'waitlisted', 'pending', 'rejected'));