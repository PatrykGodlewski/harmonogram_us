ALTER TABLE "events" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_prompt" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_seed" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_status" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_source_hash" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_image_status_check" CHECK ("events"."image_status" IN ('pending', 'ready', 'failed'));
--> statement-breakpoint
-- A replaced cover image, or one deleted with its event, leaves its key for the
-- worker to delete (as programme item images do, 0040).
CREATE OR REPLACE FUNCTION record_event_image_deletion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	IF OLD.image_key IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.image_key IS DISTINCT FROM NEW.image_key) THEN
		INSERT INTO stored_file_deletions (storage_key)
		VALUES (OLD.image_key)
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER events_record_image_deletion
AFTER UPDATE OF image_key OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION record_event_image_deletion();
