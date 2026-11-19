import { sql } from "drizzle-orm";
import { db } from "../client";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import {
	eventFacultySeeds,
	eventLocationSeeds,
	eventTypeSeeds,
	type LookupSeed,
} from "./data";

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
