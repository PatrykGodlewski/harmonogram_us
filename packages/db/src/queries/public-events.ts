import { and, asc, eq, gt, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import { eventSeatCounts } from "../schema/event-registrations";
import { type AttendanceMode, events } from "../schema/events";
import { effectiveEventEndSql } from "./event-registrations";

/** An upcoming event as other sites may read it (F24): nothing beyond the public event page. */
export type PublicEvent = {
	id: string;
	title: string;
	startsAt: Date;
	endsAt: Date;
	place: string | null;
	attendanceMode: AttendanceMode;
	faculty: { id: string; label: string } | null;
	type: { id: string; label: string } | null;
	seatsRemaining: number;
};

export type PublicEventFilters = {
	limit: number;
	facultyId?: string;
	typeId?: string;
};

/**
 * Published events open to everyone that have not ended, nearest first.
 * Cancelled, draft, signed-in-only and invite-only events never appear.
 */
export async function listUpcomingPublicEvents(
	now: Date,
	filters: PublicEventFilters,
): Promise<PublicEvent[]> {
	const end = sql<string>`${effectiveEventEndSql(sql`${events}`)}`;
	const conditions: (SQL | undefined)[] = [
		eq(events.status, "published"),
		eq(events.visibility, "public"),
		gt(end, now.toISOString()),
		filters.facultyId ? eq(events.facultyId, filters.facultyId) : undefined,
		filters.typeId ? eq(events.typeId, filters.typeId) : undefined,
	];
	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			startsAt: events.date,
			endsAt: end,
			location: eventLocations.label,
			room: events.room,
			attendanceMode: events.attendanceMode,
			facultyId: eventFaculties.id,
			facultyLabel: eventFaculties.label,
			typeId: eventTypes.id,
			typeLabel: eventTypes.label,
			maxSeats: events.maxSeats,
			seatsRemaining: eventSeatCounts.seatsRemaining,
		})
		.from(events)
		.leftJoin(eventLocations, eq(eventLocations.id, events.locationId))
		.leftJoin(eventFaculties, eq(eventFaculties.id, events.facultyId))
		.leftJoin(eventTypes, eq(eventTypes.id, events.typeId))
		.leftJoin(eventSeatCounts, eq(eventSeatCounts.eventId, events.id))
		.where(and(...conditions))
		.orderBy(asc(events.date), asc(events.id))
		.limit(filters.limit);

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		startsAt: row.startsAt,
		endsAt: new Date(row.endsAt),
		place: [row.location, row.room].filter(Boolean).join(" · ") || null,
		attendanceMode: row.attendanceMode,
		faculty:
			row.facultyId && row.facultyLabel
				? { id: row.facultyId, label: row.facultyLabel }
				: null,
		type:
			row.typeId && row.typeLabel
				? { id: row.typeId, label: row.typeLabel }
				: null,
		seatsRemaining: row.seatsRemaining ?? row.maxSeats,
	}));
}
