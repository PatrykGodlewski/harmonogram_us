import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import { eventLocations } from "../schema/event-lookups";
import {
	eventRegistrations,
	type RegistrationState,
} from "../schema/event-registrations";
import { events } from "../schema/events";
import { effectiveEventEndSql } from "./event-registrations";

export type Ticket = {
	registrationId: string;
	ticketCode: string;
	state: RegistrationState;
	eventId: string;
	title: string;
	date: Date;
	/** Event end, else the end of its last agenda item, else a day after the start. */
	effectiveEndsAt: Date;
	locationLabel: string | null;
	holderName: string;
	holderEmail: string;
};

/** The ticket of one of the user's registrations; null when it doesn't exist or isn't theirs. */
export async function getMyTicket(
	registrationId: string,
	userId: string,
): Promise<Ticket | null> {
	const [row] = await db
		.select({
			registrationId: eventRegistrations.id,
			ticketCode: eventRegistrations.ticketCode,
			state: eventRegistrations.state,
			eventId: events.id,
			title: events.title,
			date: events.date,
			effectiveEndsAt: effectiveEventEndSql(sql`events`),
			locationLabel: eventLocations.label,
			holderName: authUsers.name,
			holderEmail: authUsers.email,
		})
		.from(eventRegistrations)
		.innerJoin(events, eq(events.id, eventRegistrations.eventId))
		.innerJoin(authUsers, eq(authUsers.id, eventRegistrations.userId))
		.leftJoin(eventLocations, eq(eventLocations.id, events.locationId))
		.where(
			and(
				eq(eventRegistrations.id, registrationId),
				eq(eventRegistrations.userId, userId),
			),
		);
	return row
		? { ...row, effectiveEndsAt: new Date(row.effectiveEndsAt) }
		: null;
}
