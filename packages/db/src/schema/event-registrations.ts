import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { authUsers } from "./better-auth";
import { events } from "./events";
import { registrationGroups } from "./groups";

/** `registered` holds a place; `waitlisted` waits in `created_at` order for one. */
export type RegistrationState = "registered" | "waitlisted";

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
		groupId: text("group_id").references(() => registrationGroups.id, {
			onDelete: "set null",
		}),
		state: text("state")
			.$type<RegistrationState>()
			.notNull()
			.default("registered"),
		/** Language of the registrant's e-mails (the UI language when they registered). */
		locale: text("locale").$type<"pl" | "en">().notNull().default("pl"),
		/** Unguessable code shown as the ticket's QR code; never changes for the registration. */
		ticketCode: text("ticket_code")
			.notNull()
			.unique()
			.default(
				sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`,
			),
		/** When the person was checked in at the event (null: not present). */
		checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
		/** Insert time (not transaction start), so the waitlist follows the real order of inserts. */
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.default(sql`clock_timestamp()`),
	},
	(table) => [
		check(
			"event_registrations_state_check",
			sql`${table.state} IN ('registered', 'waitlisted')`,
		),
		check(
			"event_registrations_locale_check",
			sql`${table.locale} IN ('pl', 'en')`,
		),
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
