ALTER TABLE "event_registrations" ADD COLUMN "certificate_emailed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "certificates_sent_at";