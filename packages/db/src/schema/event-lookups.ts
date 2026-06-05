import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const generatedTextId = () => sql`(gen_random_uuid())::text`;

export const eventTypes = pgTable("event_types", {
	id: text("id").primaryKey().default(generatedTextId()),
	slug: text("slug").notNull().unique(),
	label: text("label").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const eventLocations = pgTable("event_locations", {
	id: text("id").primaryKey().default(generatedTextId()),
	slug: text("slug").notNull().unique(),
	label: text("label").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const eventFaculties = pgTable("event_faculties", {
	id: text("id").primaryKey().default(generatedTextId()),
	slug: text("slug").notNull().unique(),
	label: text("label").notNull(),
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
