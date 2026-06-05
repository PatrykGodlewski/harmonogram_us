CREATE TABLE "event_faculties" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_faculties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_locations" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_seat_counts" (
	"event_id" text PRIMARY KEY NOT NULL,
	"seats_remaining" integer NOT NULL,
	"max_seats" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"title" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"max_seats" integer NOT NULL,
	"type_id" text NOT NULL,
	"location_id" text,
	"faculty_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seat_counts" ADD CONSTRAINT "event_seat_counts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_type_id_event_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_event_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."event_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_faculty_id_event_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."event_faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_unique" ON "event_registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_event_id_idx" ON "event_registrations" USING btree ("event_id");