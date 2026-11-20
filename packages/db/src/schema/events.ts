import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { eventFaculties, eventLocations, eventTypes } from "./event-lookups";

/** `draft` is visible only in the panel; `cancelled` keeps its registrations as history. */
export type EventStatus = "draft" | "published" | "cancelled";
export type AttendanceMode = "onsite" | "online" | "hybrid";
/**
 * `authenticated` events are listed and shown only to signed-in people;
 * `private` ones are never listed and open only with the invite link (or to
 * their organisers and registrants).
 */
export type EventVisibility = "public" | "authenticated" | "private";

export const events = pgTable(
	"events",
	{
		id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
		title: text("title").notNull(),
		description: text("description"),
		date: timestamp("date", {
			withTimezone: true,
		}).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }),
		maxSeats: integer("max_seats").notNull(),
		/** Group places are released this many hours before `date`. */
		groupDeadlineHours: integer("group_deadline_hours").notNull().default(48),
		typeId: text("type_id")
			.notNull()
			.references(() => eventTypes.id),
		locationId: text("location_id").references(() => eventLocations.id),
		facultyId: text("faculty_id").references(() => eventFaculties.id),
		status: text("status").$type<EventStatus>().notNull().default("draft"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
		/** Meeting link; shown only to registered people. */
		onlineUrl: text("online_url"),
		/** A typed room ("B105"), next to the place picked from the list. */
		room: text("room"),
		/** Hours before the start when registrants get a reminder; null switches it off. */
		reminderHoursBefore: integer("reminder_hours_before").default(24),
		reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
		/** Registrations wait as `pending` until an organiser approves them. */
		requiresApproval: boolean("requires_approval").notNull().default(false),
		attendanceMode: text("attendance_mode")
			.$type<AttendanceMode>()
			.notNull()
			.default("onsite"),
		visibility: text("visibility")
			.$type<EventVisibility>()
			.notNull()
			.default("public"),
		/** Secret of the invite link of a `private` event; a new one revokes the old link. */
		inviteToken: text("invite_token").unique(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
		})
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", {
			withTimezone: true,
		})
			.notNull()
			.defaultNow(),
	},
	(table) => [
		check(
			"events_status_check",
			sql`${table.status} IN ('draft', 'published', 'cancelled')`,
		),
		check(
			"events_visibility_check",
			sql`${table.visibility} IN ('public', 'authenticated', 'private')`,
		),
		check(
			"events_attendance_mode_check",
			sql`${table.attendanceMode} IN ('onsite', 'online', 'hybrid')`,
		),
	],
);

export const eventsRelations = relations(events, ({ one }) => ({
	type: one(eventTypes, {
		fields: [events.typeId],
		references: [eventTypes.id],
	}),
	location: one(eventLocations, {
		fields: [events.locationId],
		references: [eventLocations.id],
	}),
	faculty: one(eventFaculties, {
		fields: [events.facultyId],
		references: [eventFaculties.id],
	}),
}));
