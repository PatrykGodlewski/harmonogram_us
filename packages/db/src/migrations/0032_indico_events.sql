CREATE TABLE "indico_events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"room" text,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "indico_events_starts_at_idx" ON "indico_events" USING btree ("starts_at");