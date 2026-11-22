ALTER TABLE "events" ADD COLUMN "certificates_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "certificates_sent_at" timestamp with time zone;