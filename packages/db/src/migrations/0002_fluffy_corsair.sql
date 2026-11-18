CREATE TABLE "agenda_item_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"agenda_item_id" text NOT NULL,
	"event_registration_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_item_seat_counts" (
	"agenda_item_id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"max_seats" integer,
	"seats_remaining" integer,
	"registered_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agenda_items" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"event_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location_id" text,
	"max_seats" integer,
	"requires_registration" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_items_ends_after_starts" CHECK ("agenda_items"."ends_at" > "agenda_items"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "agenda_item_registrations" ADD CONSTRAINT "agenda_item_registrations_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_item_registrations" ADD CONSTRAINT "agenda_item_registrations_event_registration_id_event_registrations_id_fk" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_item_registrations" ADD CONSTRAINT "agenda_item_registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_item_seat_counts" ADD CONSTRAINT "agenda_item_seat_counts_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_location_id_event_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."event_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agenda_item_registrations_item_user_unique" ON "agenda_item_registrations" USING btree ("agenda_item_id","user_id");--> statement-breakpoint
CREATE INDEX "agenda_item_registrations_event_registration_idx" ON "agenda_item_registrations" USING btree ("event_registration_id");--> statement-breakpoint
CREATE INDEX "agenda_items_event_starts_idx" ON "agenda_items" USING btree ("event_id","starts_at");