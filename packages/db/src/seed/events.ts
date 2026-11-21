import { sql } from "drizzle-orm";
import { db } from "../client";
import { newInviteToken } from "../queries/events";
import { agendaItems } from "../schema/agenda";
import { events } from "../schema/events";
import { agendaItemSeeds, eventSeeds } from "./data";

/** Seeded events start at 09:00 UTC, `daysFromNow` days from today; their agenda starts with them. */
function eventStart(now: Date, daysFromNow: number): Date {
	const start = new Date(now);
	start.setUTCDate(start.getUTCDate() + daysFromNow);
	start.setUTCHours(9, 0, 0, 0);
	return start;
}

export async function seedEvents() {
	const now = new Date();

	for (const event of eventSeeds) {
		await db
			.insert(events)
			.values({
				id: event.id,
				title: event.title,
				date: eventStart(now, event.daysFromNow),
				maxSeats: event.maxSeats,
				typeId: event.typeId,
				locationId: event.locationId,
				facultyId: event.facultyId,
				status: "published",
				publishedAt: now,
				requiresApproval: event.requiresApproval ?? false,
				certificatesEnabled: event.certificatesEnabled ?? false,
				visibility: event.visibility ?? "public",
				inviteToken: event.visibility === "private" ? newInviteToken() : null,
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
					requiresApproval: sql`excluded.requires_approval`,
					certificatesEnabled: sql`excluded.certificates_enabled`,
					visibility: sql`excluded.visibility`,
					// Re-seeding keeps an invite link that was already shared.
					inviteToken: sql`CASE WHEN excluded.visibility = 'private' THEN coalesce(${events.inviteToken}, excluded.invite_token) END`,
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
		const startsAt = new Date(
			eventStart(now, event.daysFromNow).getTime() + item.startHour * 3_600_000,
		);
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
				speakers: item.speakers ?? [],
				materials: item.materials ?? [],
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
					speakers: sql`excluded.speakers`,
					materials: sql`excluded.materials`,
					updatedAt: new Date(),
				},
			});
	}
}
