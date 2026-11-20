import { relations, sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { eventFaculties, eventLocations, eventTypes } from "./event-lookups";

/** `draft` is visible only in the panel; `cancelled` keeps its registrations as history. */
export type EventStatus = "draft" | "published" | "cancelled";
export type AttendanceMode = "onsite" | "online" | "hybrid";

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
		attendanceMode: text("attendance_mode")
			.$type<AttendanceMode>()
			.notNull()
			.default("onsite"),
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
