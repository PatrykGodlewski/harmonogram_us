import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	date: timestamp("date", { withTimezone: true }).notNull(),
	availableSeats: integer("available_seats").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});
