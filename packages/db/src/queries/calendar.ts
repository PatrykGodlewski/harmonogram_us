import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import { eventLocations } from "../schema/event-lookups";
import { eventRegistrations } from "../schema/event-registrations";
import { events } from "../schema/events";
import { effectiveEventEndSql } from "./event-registrations";

/** What a calendar file needs about one event. */
export type CalendarEntry = {
	id: string;
	title: string;
	description: string | null;
	start: Date;
	end: Date;
	place: string | null;
	cancelled: boolean;
};

/** How many events one feed carries at most. */
const FEED_LIMIT = 500;

const entryColumns = {
	id: events.id,
	title: events.title,
	description: events.description,
	start: events.date,
	end: sql<string>`${effectiveEventEndSql(sql`${events}`)}`,
	location: eventLocations.label,
	room: events.room,
	status: events.status,
};

type EntryRow = {
	id: string;
	title: string;
	description: string | null;
	start: Date;
	end: string;
	location: string | null;
	room: string | null;
	status: string;
};

function toEntry(row: EntryRow): CalendarEntry {
	const place = [row.location, row.room].filter(Boolean).join(" · ");
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		start: row.start,
		end: new Date(row.end),
		place: place || null,
		cancelled: row.status === "cancelled",
	};
}

function selectEntries() {
	return db
		.select(entryColumns)
		.from(events)
		.leftJoin(eventLocations, eq(eventLocations.id, events.locationId));
}

/** Public events that haven't ended (cancelled ones too, so calendars show them as cancelled). */
export async function listPublicCalendarEntries(
	now: Date,
): Promise<CalendarEntry[]> {
	const rows = await selectEntries()
		.where(
			and(
				ne(events.status, "draft"),
				eq(events.visibility, "public"),
				gte(sql`${effectiveEventEndSql(sql`${events}`)}`, now.toISOString()),
			),
		)
		.orderBy(asc(events.date))
		.limit(FEED_LIMIT);
	return rows.map(toEntry);
}

/** One event for "add to calendar"; signed-in-only events need a signed-in visitor. */
export async function getCalendarEntry(
	eventId: string,
	signedIn: boolean,
): Promise<CalendarEntry | null> {
	const [row] = await selectEntries().where(
		and(
			eq(events.id, eventId),
			ne(events.status, "draft"),
			signedIn ? undefined : eq(events.visibility, "public"),
		),
	);
	return row ? toEntry(row) : null;
}

/** The registrations (holding a place) of the person whose feed token this is; null for an unknown token. */
export async function listMyCalendarEntries(
	token: string,
): Promise<CalendarEntry[] | null> {
	const [user] = await db
		.select({ id: authUsers.id })
		.from(authUsers)
		.where(eq(authUsers.calendarToken, token));
	if (!user) {
		return null;
	}
	const mine = db
		.select({ eventId: eventRegistrations.eventId })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.userId, user.id),
				eq(eventRegistrations.state, "registered"),
			),
		);
	const rows = await selectEntries()
		.where(inArray(events.id, mine))
		.orderBy(asc(events.date))
		.limit(FEED_LIMIT);
	return rows.map(toEntry);
}

/** The personal feed token of a user. */
export async function getCalendarToken(userId: string): Promise<string | null> {
	const [row] = await db
		.select({ token: authUsers.calendarToken })
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	return row?.token ?? null;
}
