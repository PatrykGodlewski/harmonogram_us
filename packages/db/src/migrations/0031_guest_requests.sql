CREATE TABLE "guest_registration_requests" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"answers" jsonb NOT NULL,
	"invite_token" text,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_registration_requests" ADD CONSTRAINT "guest_registration_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;