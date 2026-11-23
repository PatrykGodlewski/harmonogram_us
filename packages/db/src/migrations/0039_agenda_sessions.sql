CREATE TABLE "agenda_sessions" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'blue' NOT NULL,
	"location_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_sessions_ends_after_starts" CHECK ("agenda_sessions"."ends_at" > "agenda_sessions"."starts_at"),
	CONSTRAINT "agenda_sessions_color" CHECK ("agenda_sessions"."color" IN ('slate', 'blue', 'green', 'amber', 'rose', 'violet'))
);
--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "agenda_sessions" ADD CONSTRAINT "agenda_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_sessions" ADD CONSTRAINT "agenda_sessions_location_id_event_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."event_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_sessions_event_starts_idx" ON "agenda_sessions" USING btree ("event_id","starts_at");--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_session_id_agenda_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agenda_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agenda_items_session_idx" ON "agenda_items" USING btree ("session_id");