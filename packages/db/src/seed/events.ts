import { sql } from "drizzle-orm";
import { db } from "../client";
import { agendaItems } from "../schema/agenda";
import { events } from "../schema/events";
import { agendaItemSeeds, eventSeeds } from "./data";

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export async function seedEvents() {
	const now = new Date();

	for (const event of eventSeeds) {
		await db
			.insert(events)
			.values({
				id: event.id,
				title: event.title,
				date: addDays(now, event.daysFromNow),
				maxSeats: event.maxSeats,
				typeId: event.typeId,
				locationId: event.locationId,
				facultyId: event.facultyId,
			})
			.onConflictDoUpdate({
				target: events.id,
				set: {
					title: sql`excluded.title`,
					date: sql`excluded.date`,
					maxSeats: sql`excluded.max_seats`,
					typeId: sql`excluded.type_id`,
					locationId: sql`excluded.location_id`,
					facultyId: sql`excluded.faculty_id`,
					updatedAt: new Date(),
				},
			});
	}
}

export async function seedAgenda() {
	const now = new Date();

	for (const item of agendaItemSeeds) {
		const event = eventSeeds.find((seed) => seed.id === item.eventId);
		if (!event) {
			continue;
		}
		const startsAt = addDays(now, event.daysFromNow);
		startsAt.setUTCHours(9, 0, 0, 0);
		startsAt.setTime(startsAt.getTime() + item.startHour * 3_600_000);
		const endsAt = new Date(startsAt.getTime() + item.durationMinutes * 60_000);

		await db
			.insert(agendaItems)
			.values({
				id: item.id,
				eventId: item.eventId,
				title: item.title,
				startsAt,
				endsAt,
				locationId: item.locationId,
				maxSeats: item.maxSeats,
				requiresRegistration: item.requiresRegistration,
			})
			.onConflictDoUpdate({
				target: agendaItems.id,
				set: {
					title: sql`excluded.title`,
					startsAt: sql`excluded.starts_at`,
					endsAt: sql`excluded.ends_at`,
					locationId: sql`excluded.location_id`,
					maxSeats: sql`excluded.max_seats`,
					requiresRegistration: sql`excluded.requires_registration`,
					updatedAt: new Date(),
				},
			});
	}
}
