import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { authUsers } from "./better-auth";
import { events } from "./events";

export const eventRegistrations = pgTable(
	"event_registrations",
	{
		id: text("id").primaryKey(),
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
		uniqueIndex("event_registrations_event_user_unique").on(
			table.eventId,
			table.userId,
		),
		index("event_registrations_event_id_idx").on(table.eventId),
	],
);

export const eventSeatCounts = pgTable("event_seat_counts", {
	eventId: text("event_id")
		.primaryKey()
		.references(() => events.id, { onDelete: "cascade" }),
	seatsRemaining: integer("seats_remaining").notNull(),
	maxSeats: integer("max_seats").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const eventRegistrationsRelations = relations(
	eventRegistrations,
	({ one }) => ({
		event: one(events, {
			fields: [eventRegistrations.eventId],
			references: [events.id],
		}),
		user: one(authUsers, {
			fields: [eventRegistrations.userId],
			references: [authUsers.id],
		}),
	}),
);

export const eventSeatCountsRelations = relations(
	eventSeatCounts,
	({ one }) => ({
		event: one(events, {
			fields: [eventSeatCounts.eventId],
			references: [events.id],
		}),
	}),
);
