ALTER TABLE "agenda_items" ADD COLUMN "type_id" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "faculty_id" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "audience" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "languages" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "image_key" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_type_id_event_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_faculty_id_event_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."event_faculties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenda_items" ADD CONSTRAINT "agenda_items_image_alt" CHECK ("agenda_items"."image_key" IS NULL OR "agenda_items"."image_alt" IS NOT NULL);
--> statement-breakpoint
-- A replaced or cleared programme item image, or one deleted with its item or event,
-- leaves its key for the worker to delete (as event files do, 0038).
CREATE OR REPLACE FUNCTION record_agenda_item_image_deletion() RETURNS trigger
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
CREATE TRIGGER agenda_items_record_image_deletion
AFTER UPDATE OF image_key OR DELETE ON agenda_items
FOR EACH ROW EXECUTE FUNCTION record_agenda_item_image_deletion();
