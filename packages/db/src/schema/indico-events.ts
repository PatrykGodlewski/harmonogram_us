import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A read-only copy of the university Indico's events (F16), replaced by every sync.
 * Kept apart from `events` so no registration path can ever reach an imported event.
 */
export const indicoEvents = pgTable(
	"indico_events",
	{
		/** The Indico event id (digits). */
		id: text("id").primaryKey(),
		title: text("title").notNull(),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }),
		location: text("location"),
		room: text("room"),
		/** The event page in Indico, built from the configured address and the id. */
		url: text("url").notNull(),
	},
	(table) => [index("indico_events_starts_at_idx").on(table.startsAt)],
);
