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
	faculty: { slug: string; label: string } | null;
	type: { slug: string; label: string } | null;
	seatsRemaining: number;
};

/** Faculty and type by slug, the key the site's own filters use (`?facultyFilter=`). */
export type PublicEventFilters = {
	limit: number;
	facultySlug?: string;
	typeSlug?: string;
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
		filters.facultySlug
			? eq(eventFaculties.slug, filters.facultySlug)
			: undefined,
		filters.typeSlug ? eq(eventTypes.slug, filters.typeSlug) : undefined,
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
			facultySlug: eventFaculties.slug,
			facultyLabel: eventFaculties.label,
			typeSlug: eventTypes.slug,
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
			row.facultySlug && row.facultyLabel
				? { slug: row.facultySlug, label: row.facultyLabel }
				: null,
		type:
			row.typeSlug && row.typeLabel
				? { slug: row.typeSlug, label: row.typeLabel }
				: null,
		seatsRemaining: row.seatsRemaining ?? row.maxSeats,
	}));
}
