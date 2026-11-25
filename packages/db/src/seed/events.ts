import { and, inArray, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { newInviteToken } from "../queries/events";
import { agendaItems, agendaSessions } from "../schema/agenda";
import { events } from "../schema/events";
import type { AgendaItemSeed, AgendaSessionSeed, EventSeed } from "./data";

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

/**
 * Seeded events (`evt-…`, and `gen-…` from an earlier bulk generator) that are no longer
 * in the set; user-created events have UUID ids and are never touched.
 */
export async function removeStaleEvents(seeds: EventSeed[]) {
	await db.delete(events).where(
		and(
			or(like(events.id, "evt-%"), like(events.id, "gen-%")),
			notInArray(
				events.id,
				seeds.map((event) => event.id),
			),
		),
	);
}

/** Programme items and sessions of seeded events that are no longer in the set. */
export async function removeStaleAgenda(
	eventSeeds: EventSeed[],
	sessionSeeds: AgendaSessionSeed[],
	itemSeeds: AgendaItemSeed[],
) {
	const eventIds = eventSeeds.map((event) => event.id);
	await db.delete(agendaItems).where(
		and(
			inArray(agendaItems.eventId, eventIds),
			notInArray(
				agendaItems.id,
				itemSeeds.map((item) => item.id),
			),
		),
	);
	await db.delete(agendaSessions).where(
		and(
			inArray(agendaSessions.eventId, eventIds),
			notInArray(
				agendaSessions.id,
				sessionSeeds.map((session) => session.id),
			),
		),
	);
}

export async function seedEvents(seeds: EventSeed[], now: Date) {
	for (const event of seeds) {
		const status = event.status ?? "published";
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
				status,
				publishedAt: status === "draft" ? null : now,
				cancelledAt: status === "cancelled" ? now : null,
				attendanceMode: event.attendanceMode ?? "onsite",
				onlineUrl: event.onlineUrl ?? null,
				room: event.room ?? null,
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
					status: sql`excluded.status`,
					publishedAt: sql`coalesce(${events.publishedAt}, excluded.published_at)`,
					cancelledAt: sql`excluded.cancelled_at`,
					attendanceMode: sql`excluded.attendance_mode`,
					onlineUrl: sql`excluded.online_url`,
					room: sql`excluded.room`,
					// Re-seeding keeps an invite link that was already shared.
					inviteToken: sql`CASE WHEN excluded.visibility = 'private' THEN coalesce(${events.inviteToken}, excluded.invite_token) END`,
					updatedAt: new Date(),
				},
			});
	}
}

function startOf(
	seed: { eventId: string },
	eventSeeds: EventSeed[],
	now: Date,
) {
	const event = eventSeeds.find((entry) => entry.id === seed.eventId);
	if (!event) {
		throw new Error(`Agenda seed refers to unknown event ${seed.eventId}`);
	}
	return eventStart(now, event).getTime();
}

const MINUTE = 60_000;

export async function seedSessions(
	seeds: AgendaSessionSeed[],
	eventSeeds: EventSeed[],
	now: Date,
) {
	for (const session of seeds) {
		const startsAt = new Date(
			startOf(session, eventSeeds, now) + session.startMinute * MINUTE,
		);
		const values = {
			id: session.id,
			eventId: session.eventId,
			title: session.title,
			description: session.description,
			color: session.color,
			locationId: session.locationId,
			startsAt,
			endsAt: new Date(startsAt.getTime() + session.durationMinutes * MINUTE),
		};
		await db
			.insert(agendaSessions)
			.values(values)
			.onConflictDoUpdate({
				target: agendaSessions.id,
				set: { ...values, id: undefined, updatedAt: new Date() },
			});
	}
}

export async function seedAgenda(
	items: AgendaItemSeed[],
	eventSeeds: EventSeed[],
	now: Date,
) {
	for (const item of items) {
		const startsAt = new Date(
			startOf(item, eventSeeds, now) + item.startMinute * MINUTE,
		);
		const values = {
			id: item.id,
			eventId: item.eventId,
			sessionId: item.sessionId ?? null,
			title: item.title,
			description: item.description,
			startsAt,
			endsAt: new Date(startsAt.getTime() + item.durationMinutes * MINUTE),
			locationId: item.locationId,
			maxSeats: item.maxSeats,
			requiresRegistration: item.requiresRegistration,
			typeId: item.typeId ?? null,
			facultyId: item.facultyId ?? null,
			topic: item.topic ?? null,
			audience: item.audience ?? null,
			languages: item.languages ?? [],
			speakers: item.speakers ?? [],
			materials: item.materials ?? [],
		};
		await db
			.insert(agendaItems)
			.values(values)
			.onConflictDoUpdate({
				target: agendaItems.id,
				set: { ...values, id: undefined, updatedAt: new Date() },
			});
	}
}
