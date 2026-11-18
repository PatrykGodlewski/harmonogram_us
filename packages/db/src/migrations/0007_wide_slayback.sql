CREATE TABLE "registration_group_items" (
	"group_id" text NOT NULL,
	"agenda_item_id" text NOT NULL,
	CONSTRAINT "registration_group_items_group_id_agenda_item_id_pk" PRIMARY KEY("group_id","agenda_item_id")
);
--> statement-breakpoint
CREATE TABLE "registration_group_member_items" (
	"member_id" text NOT NULL,
	"agenda_item_id" text NOT NULL,
	CONSTRAINT "registration_group_member_items_member_id_agenda_item_id_pk" PRIMARY KEY("member_id","agenda_item_id")
);
--> statement-breakpoint
CREATE TABLE "registration_group_members" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"group_id" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_via" text NOT NULL,
	"token_hash" text,
	"user_id" text,
	"event_registration_id" text,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "registration_group_members_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "registration_groups" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid())::text NOT NULL,
	"event_id" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text,
	"places" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"join_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_groups_join_code_unique" UNIQUE("join_code"),
	CONSTRAINT "registration_groups_places_positive" CHECK ("registration_groups"."places" > 0)
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "group_deadline_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_group_items" ADD CONSTRAINT "registration_group_items_group_id_registration_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."registration_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_items" ADD CONSTRAINT "registration_group_items_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_member_items" ADD CONSTRAINT "registration_group_member_items_member_id_registration_group_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."registration_group_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_member_items" ADD CONSTRAINT "registration_group_member_items_agenda_item_id_agenda_items_id_fk" FOREIGN KEY ("agenda_item_id") REFERENCES "public"."agenda_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_members" ADD CONSTRAINT "registration_group_members_group_id_registration_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."registration_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_members" ADD CONSTRAINT "registration_group_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_group_members" ADD CONSTRAINT "registration_group_members_event_registration_id_event_registrations_id_fk" FOREIGN KEY ("event_registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_groups" ADD CONSTRAINT "registration_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_groups" ADD CONSTRAINT "registration_groups_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "registration_group_members_group_email_unique" ON "registration_group_members" USING btree ("group_id","email");--> statement-breakpoint
CREATE INDEX "registration_groups_event_idx" ON "registration_groups" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "registration_groups_owner_idx" ON "registration_groups" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_group_id_registration_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."registration_groups"("id") ON DELETE set null ON UPDATE no action;