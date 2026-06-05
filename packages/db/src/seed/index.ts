import { sql } from "drizzle-orm";
import { db } from "../client";
import { eventFaculties } from "../schema/event-faculties";
import { eventLocations } from "../schema/event-locations";
import { eventTypes } from "../schema/event-types";
import { events } from "../schema/events";
import {
	eventFacultySeeds,
	eventLocationSeeds,
	eventSeeds,
	eventTypeSeeds,
	type LookupSeed,
} from "./data";

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

async function upsertLookups<T extends LookupSeed>(
	table: typeof eventTypes | typeof eventLocations | typeof eventFaculties,
	rows: T[],
) {
	if (rows.length === 0) {
		return;
	}

	await db
		.insert(table)
		.values(rows)
		.onConflictDoUpdate({
			target: table.id,
			set: {
				slug: sql`excluded.slug`,
				label: sql`excluded.label`,
				sortOrder: sql`excluded.sort_order`,
				updatedAt: new Date(),
			},
		});
}

export async function seedEventLookups() {
	await upsertLookups(eventTypes, eventTypeSeeds);
	await upsertLookups(eventLocations, eventLocationSeeds);
	await upsertLookups(eventFaculties, eventFacultySeeds);
}

export async function seedSampleEvents() {
	const now = new Date();

	for (const event of eventSeeds) {
		await db
			.insert(events)
			.values({
				id: event.id,
				title: event.title,
				date: addDays(now, event.daysFromNow),
				availableSeats: event.availableSeats,
				typeId: event.typeId,
				locationId: event.locationId,
				facultyId: event.facultyId,
			})
			.onConflictDoUpdate({
				target: events.id,
				set: {
					title: sql`excluded.title`,
					date: sql`excluded.date`,
					availableSeats: sql`excluded.available_seats`,
					typeId: sql`excluded.type_id`,
					locationId: sql`excluded.location_id`,
					facultyId: sql`excluded.faculty_id`,
					updatedAt: new Date(),
				},
			});
	}
}

export async function seedDatabase() {
	await seedEventLookups();
	await seedSampleEvents();
}
