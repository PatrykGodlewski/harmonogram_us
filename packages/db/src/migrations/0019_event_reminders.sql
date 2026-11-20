ALTER TABLE "events" ADD COLUMN "reminder_hours_before" integer DEFAULT 24;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
-- Events that already started or ended must not get a reminder now.
UPDATE "events" SET "reminder_sent_at" = now() WHERE "date" <= now() + interval '24 hours';
