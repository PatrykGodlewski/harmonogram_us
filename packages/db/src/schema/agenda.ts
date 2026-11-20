import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { authUsers } from "./better-auth";
import { eventLocations } from "./event-lookups";
import { eventRegistrations } from "./event-registrations";
import { events } from "./events";

/** Who speaks at a programme item ("dr Anna Nowak", "Instytut Fizyki"). */
export type AgendaSpeaker = { name: string; affiliation?: string };
/** A link to slides, a recording or a paper. */
export type AgendaMaterial = { label: string; url: string };

export const agendaItems = pgTable(
	"agenda_items",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		locationId: text("location_id").references(() => eventLocations.id),
		/** NULL = no limit of its own (still bounded by the event). */
		maxSeats: integer("max_seats"),
		requiresRegistration: boolean("requires_registration")
			.notNull()
			.default(true),
		speakers: jsonb("speakers").$type<AgendaSpeaker[]>().notNull().default([]),
		materials: jsonb("materials")
			.$type<AgendaMaterial[]>()
			.notNull()
			.default([]),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("agenda_items_event_starts_idx").on(table.eventId, table.startsAt),
		check(
			"agenda_items_ends_after_starts",
			sql`${table.endsAt} > ${table.startsAt}`,
		),
	],
);

export const agendaItemRegistrations = pgTable(
	"agenda_item_registrations",
	{
		id: text("id").primaryKey(),
		agendaItemId: text("agenda_item_id")
			.notNull()
			.references(() => agendaItems.id, { onDelete: "cascade" }),
		eventRegistrationId: text("event_registration_id")
			.notNull()
			.references(() => eventRegistrations.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => authUsers.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("agenda_item_registrations_item_user_unique").on(
			table.agendaItemId,
			table.userId,
		),
		index("agenda_item_registrations_event_registration_idx").on(
			table.eventRegistrationId,
		),
	],
);

/**
 * Maintained by triggers (migration 0003). The CHECK
 * `agenda_item_seat_counts_seats_remaining_nonnegative` also lives there.
 */
export const agendaItemSeatCounts = pgTable("agenda_item_seat_counts", {
	agendaItemId: text("agenda_item_id")
		.primaryKey()
		.references(() => agendaItems.id, { onDelete: "cascade" }),
	eventId: text("event_id").notNull(),
	maxSeats: integer("max_seats"),
	seatsRemaining: integer("seats_remaining"),
	registeredCount: integer("registered_count").notNull().default(0),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const agendaItemsRelations = relations(agendaItems, ({ one }) => ({
	event: one(events, {
		fields: [agendaItems.eventId],
		references: [events.id],
	}),
	location: one(eventLocations, {
		fields: [agendaItems.locationId],
		references: [eventLocations.id],
	}),
}));

export const agendaItemRegistrationsRelations = relations(
	agendaItemRegistrations,
	({ one }) => ({
		agendaItem: one(agendaItems, {
			fields: [agendaItemRegistrations.agendaItemId],
			references: [agendaItems.id],
		}),
		eventRegistration: one(eventRegistrations, {
			fields: [agendaItemRegistrations.eventRegistrationId],
			references: [eventRegistrations.id],
		}),
	}),
);
