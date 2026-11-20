import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import { eventRegistrations } from "../schema/event-registrations";
import { events } from "../schema/events";
import { DomainError } from "./domain-errors";

export type CheckInResult = {
	status: "checked-in" | "already-checked-in";
	registrationId: string;
	name: string;
	email: string;
	checkedInAt: Date;
};

/**
 * Checks in the holder of a ticket at the event. A second scan reports the
 * original time instead of failing, so a re-scan at the door is harmless.
 */
export async function checkInByTicketCode(
	eventId: string,
	ticketCode: string,
): Promise<CheckInResult> {
	const [ticket] = await db
		.select({
			registrationId: eventRegistrations.id,
			state: eventRegistrations.state,
			checkedInAt: eventRegistrations.checkedInAt,
			name: authUsers.name,
			email: authUsers.email,
			eventStatus: events.status,
		})
		.from(eventRegistrations)
		.innerJoin(authUsers, eq(authUsers.id, eventRegistrations.userId))
		.innerJoin(events, eq(events.id, eventRegistrations.eventId))
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.ticketCode, ticketCode),
			),
		);
	if (!ticket) {
		throw new DomainError("TICKET_NOT_FOUND");
	}
	if (ticket.eventStatus === "cancelled") {
		throw new DomainError("EVENT_CANCELLED");
	}
	if (ticket.state !== "registered") {
		throw new DomainError("TICKET_WAITLISTED");
	}
	const person = {
		registrationId: ticket.registrationId,
		name: ticket.name,
		email: ticket.email,
	};
	// Only the first scan sets the time (two scanners at once can't both win).
	const [updated] = await db
		.update(eventRegistrations)
		.set({ checkedInAt: new Date() })
		.where(
			and(
				eq(eventRegistrations.id, ticket.registrationId),
				isNull(eventRegistrations.checkedInAt),
			),
		)
		.returning({ checkedInAt: eventRegistrations.checkedInAt });
	if (updated?.checkedInAt) {
		return {
			...person,
			status: "checked-in",
			checkedInAt: updated.checkedInAt,
		};
	}
	const [current] = await db
		.select({ checkedInAt: eventRegistrations.checkedInAt })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.id, ticket.registrationId));
	return {
		...person,
		status: "already-checked-in",
		checkedInAt: current?.checkedInAt ?? ticket.checkedInAt ?? new Date(),
	};
}

/** The manual attendance switch on the registrant list. */
export async function setCheckedIn(
	eventId: string,
	registrationId: string,
	checkedIn: boolean,
): Promise<void> {
	const [row] = await db
		.update(eventRegistrations)
		.set({ checkedInAt: checkedIn ? new Date() : null })
		.where(
			and(
				eq(eventRegistrations.id, registrationId),
				eq(eventRegistrations.eventId, eventId),
			),
		)
		.returning({ id: eventRegistrations.id });
	if (!row) {
		throw new DomainError("NOT_REGISTERED");
	}
}
