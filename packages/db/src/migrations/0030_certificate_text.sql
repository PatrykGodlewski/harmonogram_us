ALTER TABLE "events" ADD COLUMN "certificate_issuer" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "certificate_signer" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "certificate_note" text;