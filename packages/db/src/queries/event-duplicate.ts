import { env } from "@repo/env/client";
import { eq, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db, type TransactionClient } from "../client";
import { agendaItems } from "../schema/agenda";
import { eventOrganizers } from "../schema/event-organizers";
import { events } from "../schema/events";
import { DomainError } from "./domain-errors";
import { newInviteToken } from "./events";

export type DuplicateEventInput = {
	eventId: string;
	/** Start of the (first) copy. */
	date: Date;
	/** One copy, or a series a week or a month apart (default "once"). */
	repeat?: "once" | "weekly" | "monthly";
	/** Copies in the series (1–12; default 1). */
	count?: number;
	/** What to copy besides the event's fields (default: everything). */
	copy?: { agenda: boolean; organizers: boolean };
	/** Who duplicates: becomes an organizer of every copy. */
	actorId: string;
};

const STEP = { once: "0 days", weekly: "1 week", monthly: "1 month" } as const;

/**
 * Copies an event as drafts: one at `date`, or a weekly/monthly series from it.
 * Each copy has the event's fields and, as chosen, its agenda and organizers
 * (plus the actor) — never registrations or groups. Times keep the wall clock in
 * the installation time zone (10:00 stays 10:00 across a daylight-saving change;
 * monthly from the 31st lands on shorter months' last day).
 */
export async function duplicateEvent(
	input: DuplicateEventInput,
): Promise<{ id: string; ids: string[] }> {
	const zone = env.VITE_APP_TIME_ZONE;
	const repeat = input.repeat ?? "once";
	const count =
		repeat === "once" ? 1 : Math.min(Math.max(input.count ?? 1, 1), 12);
	const copy = input.copy ?? { agenda: true, organizers: true };
	return db.transaction(async (tx) => {
		const [source] = await tx
			.select()
			.from(events)
			.where(eq(events.id, input.eventId));
		if (!source) {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		// Each step from the first date's wall clock (not cumulative), back to an instant.
		const dates = await tx.execute<{ date: string }>(sql`
			SELECT ((${input.date.toISOString()}::timestamptz AT TIME ZONE ${zone})
				+ i * ${STEP[repeat]}::interval) AT TIME ZONE ${zone} AS date
			FROM generate_series(0, ${count - 1}) AS i
			ORDER BY i`);
		const organizerIds = copy.organizers
			? (
					await tx
						.select({ userId: eventOrganizers.userId })
						.from(eventOrganizers)
						.where(eq(eventOrganizers.eventId, source.id))
				).map((row) => row.userId)
			: [];
		const ids: string[] = [];
		for (const row of dates) {
			ids.push(
				await copyEvent(tx, source, new Date(row.date), {
					agenda: copy.agenda,
					organizerIds: [...new Set([...organizerIds, input.actorId])],
				}),
			);
		}
		return { id: ids[0] ?? "", ids };
	});
}

async function copyEvent(
	tx: TransactionClient,
	source: typeof events.$inferSelect,
	date: Date,
	options: { agenda: boolean; organizerIds: string[] },
): Promise<string> {
	const zone = env.VITE_APP_TIME_ZONE;
	// Local time of the copy minus local time of the source, as an interval.
	const shift = sql`((${date.toISOString()}::timestamptz AT TIME ZONE ${zone}) - (${source.date.toISOString()}::timestamptz AT TIME ZONE ${zone}))`;
	const moved = (time: AnyPgColumn | SQL) =>
		sql<Date>`(((${time} AT TIME ZONE ${zone}) + ${shift}) AT TIME ZONE ${zone})`;

	const [copy] = await tx
		.insert(events)
		.values({
			title: source.title,
			description: source.description,
			date,
			endsAt: source.endsAt
				? moved(sql`${source.endsAt.toISOString()}::timestamptz`)
				: null,
			maxSeats: source.maxSeats,
			groupDeadlineHours: source.groupDeadlineHours,
			typeId: source.typeId,
			locationId: source.locationId,
			facultyId: source.facultyId,
			onlineUrl: source.onlineUrl,
			attendanceMode: source.attendanceMode,
			visibility: source.visibility,
			inviteToken: source.visibility === "private" ? newInviteToken() : null,
			room: source.room,
			reminderHoursBefore: source.reminderHoursBefore,
			requiresApproval: source.requiresApproval,
			certificatesEnabled: source.certificatesEnabled,
			certificateIssuer: source.certificateIssuer,
			certificateSigner: source.certificateSigner,
			certificateNote: source.certificateNote,
			materials: source.materials,
			status: "draft",
		})
		.returning({ id: events.id });
	if (!copy) {
		throw new DomainError("EVENT_NOT_FOUND");
	}

	if (options.agenda) {
		await tx.insert(agendaItems).select(
			tx
				.select({
					id: sql<string>`gen_random_uuid()::text`.as("id"),
					eventId: sql<string>`${copy.id}`.as("event_id"),
					title: agendaItems.title,
					description: agendaItems.description,
					startsAt: moved(agendaItems.startsAt).as("starts_at"),
					endsAt: moved(agendaItems.endsAt).as("ends_at"),
					locationId: agendaItems.locationId,
					maxSeats: agendaItems.maxSeats,
					requiresRegistration: agendaItems.requiresRegistration,
					speakers: agendaItems.speakers,
					materials: agendaItems.materials,
					createdAt: sql<Date>`now()`.as("created_at"),
					updatedAt: sql<Date>`now()`.as("updated_at"),
				})
				.from(agendaItems)
				.where(eq(agendaItems.eventId, source.id)),
		);
	}

	await tx
		.insert(eventOrganizers)
		.values(
			options.organizerIds.map((userId) => ({ eventId: copy.id, userId })),
		);
	return copy.id;
}
