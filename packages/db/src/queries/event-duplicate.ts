import { env } from "@repo/env/client";
import { eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "../client";
import { agendaItems } from "../schema/agenda";
import { eventOrganizers } from "../schema/event-organizers";
import { events } from "../schema/events";
import { DomainError } from "./domain-errors";

export type DuplicateEventInput = {
	eventId: string;
	/** Start of the copy. */
	date: Date;
	/** Who duplicates: becomes an organizer of the copy. */
	actorId: string;
};

/**
 * Copies an event as a draft starting at `date`: its fields, its agenda and its
 * organizers (plus the actor), not its registrations or groups. Times move by
 * the wall-clock difference in the installation time zone, so 10:00 stays 10:00
 * across a daylight-saving change.
 */
export async function duplicateEvent(
	input: DuplicateEventInput,
): Promise<{ id: string }> {
	const zone = env.VITE_APP_TIME_ZONE;
	return db.transaction(async (tx) => {
		const [source] = await tx
			.select()
			.from(events)
			.where(eq(events.id, input.eventId));
		if (!source) {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		// Local time of the copy minus local time of the source, as an interval.
		const shift = sql`((${input.date.toISOString()}::timestamptz AT TIME ZONE ${zone}) - (${source.date.toISOString()}::timestamptz AT TIME ZONE ${zone}))`;
		const moved = (column: AnyPgColumn) =>
			sql<Date>`(((${column} AT TIME ZONE ${zone}) + ${shift}) AT TIME ZONE ${zone})`;

		const [copy] = await tx
			.insert(events)
			.values({
				title: source.title,
				description: source.description,
				date: input.date,
				endsAt: source.endsAt
					? sql`(((${source.endsAt.toISOString()}::timestamptz AT TIME ZONE ${zone}) + ${shift}) AT TIME ZONE ${zone})`
					: null,
				maxSeats: source.maxSeats,
				groupDeadlineHours: source.groupDeadlineHours,
				typeId: source.typeId,
				locationId: source.locationId,
				facultyId: source.facultyId,
				onlineUrl: source.onlineUrl,
				attendanceMode: source.attendanceMode,
				status: "draft",
			})
			.returning({ id: events.id });
		if (!copy) {
			throw new DomainError("EVENT_NOT_FOUND");
		}

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
					createdAt: sql<Date>`now()`.as("created_at"),
					updatedAt: sql<Date>`now()`.as("updated_at"),
				})
				.from(agendaItems)
				.where(eq(agendaItems.eventId, source.id)),
		);

		await tx.insert(eventOrganizers).select(
			tx
				.selectDistinct({
					eventId: sql<string>`${copy.id}`.as("event_id"),
					userId: sql<string>`u.user_id`.as("user_id"),
					createdAt: sql<Date>`now()`.as("created_at"),
				})
				.from(
					sql`(SELECT user_id FROM event_organizers WHERE event_id = ${source.id} UNION SELECT ${input.actorId}) AS u`,
				),
		);
		return { id: copy.id };
	});
}
