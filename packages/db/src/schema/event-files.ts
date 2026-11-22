import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agendaItems } from "./agenda";
import { events } from "./events";

/** A file at an event (F14), optionally of one programme item (F19); the bytes live in the bucket. */
export const eventFiles = pgTable(
	"event_files",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		agendaItemId: text("agenda_item_id").references(() => agendaItems.id, {
			onDelete: "cascade",
		}),
		/** Shown and used as the download name. */
		name: text("name").notNull(),
		/** Set by the server from the extension, never taken from the client. */
		contentType: text("content_type").notNull(),
		size: integer("size").notNull(),
		storageKey: text("storage_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("event_files_event_created_idx").on(table.eventId, table.createdAt),
		index("event_files_agenda_item_idx").on(table.agendaItemId),
	],
);

/**
 * Objects to remove from the bucket. A trigger adds the key of every deleted
 * `event_files` row (also through event and programme item deletion); the
 * worker deletes the objects and then these rows.
 */
export const storedFileDeletions = pgTable("stored_file_deletions", {
	storageKey: text("storage_key").primaryKey(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
