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
import type { AgendaLanguage } from "../agenda-languages";
import { authUsers } from "./better-auth";
import { eventFaculties, eventLocations, eventTypes } from "./event-lookups";
import { eventRegistrations } from "./event-registrations";
import { events } from "./events";

/** Who leads a programme item: "dr Anna Nowak", institution "Instytut Fizyki", unit, short bio. */
export type AgendaSpeaker = {
	name: string;
	affiliation?: string;
	unit?: string;
	bio?: string;
};

/** A link to slides, a recording or a paper. */
export type AgendaMaterial = { label: string; url: string };

/** Calendar colours a session may have (classes in the UI keep text contrast). */
export const AGENDA_SESSION_COLORS = [
	"slate",
	"blue",
	"green",
	"amber",
	"rose",
	"violet",
] as const;
export type AgendaSessionColor = (typeof AGENDA_SESSION_COLORS)[number];

/** A part of the programme with its own theme, place and time (F33, like Indico's sessions). */
export const agendaSessions = pgTable(
	"agenda_sessions",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description"),
		color: text("color").$type<AgendaSessionColor>().notNull().default("blue"),
		locationId: text("location_id").references(() => eventLocations.id),
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("agenda_sessions_event_starts_idx").on(table.eventId, table.startsAt),
		check(
			"agenda_sessions_ends_after_starts",
			sql`${table.endsAt} > ${table.startsAt}`,
		),
		check(
			"agenda_sessions_color",
			sql`${table.color} IN ('slate', 'blue', 'green', 'amber', 'rose', 'violet')`,
		),
	],
);

export const agendaItems = pgTable(
	"agenda_items",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		eventId: text("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		/** NULL = outside any session. Deleting the session deletes its programme. */
		sessionId: text("session_id").references(() => agendaSessions.id, {
			onDelete: "cascade",
		}),
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
		/** Category ("Wykład", "Warsztaty"), from the same list as events. */
		typeId: text("type_id").references(() => eventTypes.id, {
			onDelete: "set null",
		}),
		/** The organising unit. */
		facultyId: text("faculty_id").references(() => eventFaculties.id, {
			onDelete: "set null",
		}),
		/** Field of knowledge ("Sztuka"), in the organiser's words. */
		topic: text("topic"),
		/** Who it is for ("dla wszystkich", "15+"), in the organiser's words. */
		audience: text("audience"),
		languages: text("languages")
			.array()
			.$type<AgendaLanguage[]>()
			.notNull()
			.default(sql`'{}'::text[]`),
		/** Bucket key of the item's image; a trigger queues a replaced one for deletion. */
		imageKey: text("image_key"),
		imageAlt: text("image_alt"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"agenda_items_image_alt",
			sql`${table.imageKey} IS NULL OR ${table.imageAlt} IS NOT NULL`,
		),
		index("agenda_items_event_starts_idx").on(table.eventId, table.startsAt),
		index("agenda_items_session_idx").on(table.sessionId),
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
