import { relations, sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { eventFaculties, eventLocations, eventTypes } from "./event-lookups";

export const events = pgTable("events", {
	id: text("id").primaryKey().default(sql`(gen_random_uuid())::text`),
	title: text("title").notNull(),
	date: timestamp("date", {
		withTimezone: true,
	}).notNull(),
	maxSeats: integer("max_seats").notNull(),
	typeId: text("type_id")
		.notNull()
		.references(() => eventTypes.id),
	locationId: text("location_id").references(() => eventLocations.id),
	facultyId: text("faculty_id").references(() => eventFaculties.id),
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
});

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
