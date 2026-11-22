import { sql } from "drizzle-orm";
import { db } from "../client";
import { newInviteToken } from "../queries/events";
import { agendaItems } from "../schema/agenda";
import { events } from "../schema/events";
import type { AgendaItemSeed, EventSeed } from "./data";

const HOUR = 3_600_000;

/**
 * When a seeded event starts: `hoursFromNow` hours from now (rounded down to the hour),
 * or `daysFromNow` days from today at `startHourUtc` (default 09:00 UTC).
 */
export function eventStart(now: Date, event: EventSeed): Date {
	const start = new Date(now);
	if (event.hoursFromNow !== undefined) {
		start.setUTCMinutes(0, 0, 0);
		return new Date(start.getTime() + event.hoursFromNow * HOUR);
	}
	start.setUTCDate(start.getUTCDate() + event.daysFromNow);
	start.setUTCHours(event.startHourUtc ?? 9, 0, 0, 0);
	return start;
}

export function eventEnd(now: Date, event: EventSeed): Date | null {
	return event.durationHours === undefined
		? null
		: new Date(eventStart(now, event).getTime() + event.durationHours * HOUR);
}

export async function seedEvents(seeds: EventSeed[], now: Date) {
	for (const event of seeds) {
		await db
			.insert(events)
			.values({
				id: event.id,
				title: event.title,
				description: event.description ?? null,
				date: eventStart(now, event),
				endsAt: eventEnd(now, event),
				maxSeats: event.maxSeats,
				groupDeadlineHours: event.groupDeadlineHours ?? 48,
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
					description: sql`excluded.description`,
					date: sql`excluded.date`,
					endsAt: sql`excluded.ends_at`,
					maxSeats: sql`excluded.max_seats`,
					groupDeadlineHours: sql`excluded.group_deadline_hours`,
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

export async function seedAgenda(
	items: AgendaItemSeed[],
	eventSeeds: EventSeed[],
	now: Date,
) {
	for (const item of items) {
		const event = eventSeeds.find((seed) => seed.id === item.eventId);
		if (!event) {
			throw new Error(`Agenda seed refers to unknown event ${item.eventId}`);
		}
		const startsAt = new Date(
			eventStart(now, event).getTime() + item.startHour * HOUR,
		);
		const endsAt = new Date(startsAt.getTime() + item.durationMinutes * 60_000);

		await db
			.insert(agendaItems)
			.values({
				id: item.id,
				eventId: item.eventId,
				title: item.title,
				description: item.description,
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
					description: sql`excluded.description`,
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
