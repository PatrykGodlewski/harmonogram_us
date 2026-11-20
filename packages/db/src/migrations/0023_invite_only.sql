ALTER TABLE "events" DROP CONSTRAINT "events_visibility_check";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "invite_token" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_invite_token_unique" UNIQUE("invite_token");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_visibility_check" CHECK ("events"."visibility" IN ('public', 'authenticated', 'private'));