-- Group hold triggers per statement instead of per row: inviting 500 students
-- refreshed counts thousands of times under the event lock. Each statement now
-- refreshes each affected event (and its items) or item once. Refresh
-- functions are unchanged (lock-first, fresh snapshot).

DROP TRIGGER IF EXISTS registration_group_members_seat_count ON registration_group_members;
--> statement-breakpoint
DROP TRIGGER IF EXISTS registration_group_items_seat_count ON registration_group_items;
--> statement-breakpoint
DROP TRIGGER IF EXISTS registration_group_member_items_seat_count ON registration_group_member_items;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_events_of_member_rows(member_group_ids text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	target record;
BEGIN
	FOR target IN
		SELECT DISTINCT g.event_id
		FROM registration_groups g
		WHERE g.id = ANY (member_group_ids)
		ORDER BY g.event_id
	LOOP
		PERFORM refresh_event_and_item_seat_counts(target.event_id);
	END LOOP;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION group_members_inserted_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM refresh_events_of_member_rows(ARRAY(SELECT DISTINCT group_id FROM new_rows));
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION group_members_deleted_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM refresh_events_of_member_rows(ARRAY(SELECT DISTINCT group_id FROM old_rows));
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION group_members_updated_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	-- Only a status change affects holds (invitedAt/token updates don't).
	PERFORM refresh_events_of_member_rows(ARRAY(
		SELECT DISTINCT n.group_id
		FROM new_rows n
		JOIN old_rows o ON o.id = n.id
		WHERE o.status IS DISTINCT FROM n.status
	));
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER registration_group_members_inserted
AFTER INSERT ON registration_group_members
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION group_members_inserted_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_members_deleted
AFTER DELETE ON registration_group_members
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION group_members_deleted_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_members_updated
AFTER UPDATE ON registration_group_members
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION group_members_updated_trigger();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION refresh_items(item_ids text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
	target record;
BEGIN
	FOR target IN SELECT DISTINCT id FROM unnest(item_ids) AS id ORDER BY id
	LOOP
		PERFORM refresh_agenda_item_seat_count(target.id);
	END LOOP;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION item_links_inserted_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM refresh_items(ARRAY(SELECT agenda_item_id FROM new_rows));
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION item_links_deleted_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	PERFORM refresh_items(ARRAY(SELECT agenda_item_id FROM old_rows));
	RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TRIGGER registration_group_items_inserted
AFTER INSERT ON registration_group_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION item_links_inserted_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_items_deleted
AFTER DELETE ON registration_group_items
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION item_links_deleted_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_member_items_inserted
AFTER INSERT ON registration_group_member_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION item_links_inserted_trigger();
--> statement-breakpoint

CREATE TRIGGER registration_group_member_items_deleted
AFTER DELETE ON registration_group_member_items
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION item_links_deleted_trigger();
--> statement-breakpoint

DROP FUNCTION IF EXISTS registration_group_members_seat_count_trigger();
--> statement-breakpoint
DROP FUNCTION IF EXISTS group_item_links_seat_count_trigger();
