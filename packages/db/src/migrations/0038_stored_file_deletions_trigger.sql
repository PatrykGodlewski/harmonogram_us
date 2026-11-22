-- Every removed file row (directly, or through its event or programme item) leaves its
-- storage key behind; the worker deletes the object, then the key (F14).
CREATE OR REPLACE FUNCTION record_stored_file_deletion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO stored_file_deletions (storage_key)
	VALUES (OLD.storage_key)
	ON CONFLICT DO NOTHING;
	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER event_files_record_deletion
AFTER DELETE ON event_files
FOR EACH ROW EXECUTE FUNCTION record_stored_file_deletion();
