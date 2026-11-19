import { asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import type { RegistrationState } from "../schema/event-registrations";
import { effectiveEventEndSql } from "./event-registrations";

export type MyRegistrationListItem = {
	registrationId: string;
	eventId: string;
	title: string;
	date: Date;
	/** Event end, else the end of its last agenda item, else a day after the start. */
	effectiveEndsAt: Date;
	locationLabel: string | null;
	state: RegistrationState;
	/** 1-based place on the waitlist; null when registered. */
	waitlistPosition: number | null;
	items: { id: string; title: string; startsAt: Date; endsAt: Date }[];
};

/** The user's event registrations with their agenda items, soonest first (the account page). */
export async function listMyRegistrations(
	userId: string,
): Promise<MyRegistrationListItem[]> {
	const [rows, itemRows] = await Promise.all([
		db.execute<{
			registration_id: string;
			event_id: string;
			title: string;
			date: string;
			effective_ends_at: string;
			location_label: string | null;
			state: RegistrationState;
			position: number | null;
		}>(sql`
			SELECT mine.id AS registration_id, e.id AS event_id, e.title, e.date,
				${effectiveEventEndSql(sql`e`)} AS effective_ends_at,
				l.label AS location_label,
				mine.state,
				CASE WHEN mine.state = 'waitlisted' THEN (
					SELECT count(*)::int FROM event_registrations w
					WHERE w.event_id = mine.event_id AND w.state = 'waitlisted'
						AND (w.created_at, w.id) <= (mine.created_at, mine.id)
				) END AS position
			FROM event_registrations mine
			JOIN events e ON e.id = mine.event_id
			LEFT JOIN event_locations l ON l.id = e.location_id
			WHERE mine.user_id = ${userId}
			ORDER BY e.date, e.id
		`),
		db
			.select({
				id: agendaItems.id,
				eventId: agendaItems.eventId,
				title: agendaItems.title,
				startsAt: agendaItems.startsAt,
				endsAt: agendaItems.endsAt,
			})
			.from(agendaItemRegistrations)
			.innerJoin(
				agendaItems,
				eq(agendaItems.id, agendaItemRegistrations.agendaItemId),
			)
			.where(eq(agendaItemRegistrations.userId, userId))
			.orderBy(asc(agendaItems.startsAt)),
	]);

	return rows.map((row) => ({
		registrationId: row.registration_id,
		eventId: row.event_id,
		title: row.title,
		date: new Date(row.date),
		effectiveEndsAt: new Date(row.effective_ends_at),
		locationLabel: row.location_label,
		state: row.state,
		waitlistPosition: row.position,
		items: itemRows
			.filter((item) => item.eventId === row.event_id)
			.map(({ eventId: _eventId, ...item }) => item),
	}));
}
