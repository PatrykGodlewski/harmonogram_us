ALTER TABLE "events" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "online_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "attendance_mode" text DEFAULT 'onsite' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_status_check" CHECK ("events"."status" IN ('draft', 'published', 'cancelled'));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_attendance_mode_check" CHECK ("events"."attendance_mode" IN ('onsite', 'online', 'hybrid'));--> statement-breakpoint
-- Events that existed before drafts were already public.
UPDATE "events" SET "status" = 'published', "published_at" = "created_at";
