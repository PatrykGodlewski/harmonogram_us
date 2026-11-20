import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { authUsers } from "./better-auth";
import { events } from "./events";

/** Who manages an event (besides admins). The creator is added on creation. */
export const eventOrganizers = pgTable(
	"event_organizers",
	{
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.eventId, table.userId] }),
		index("event_organizers_user_id_idx").on(table.userId),
	],
);

export const eventOrganizersRelations = relations(
	eventOrganizers,
	({ one }) => ({
		event: one(events, {
			fields: [eventOrganizers.eventId],
			references: [events.id],
		}),
		user: one(authUsers, {
			fields: [eventOrganizers.userId],
			references: [authUsers.id],
		}),
	}),
);
