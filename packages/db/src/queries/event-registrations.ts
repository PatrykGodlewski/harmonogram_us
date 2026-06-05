import { and, count, eq } from "drizzle-orm";
import { db } from "../client";
import { eventRegistrations } from "../schema/event-registrations";
import { events } from "../schema/events";
import { getCurrentTxId } from "./txid";

export class EventRegistrationError extends Error {
	constructor(
		readonly code:
			| "EVENT_NOT_FOUND"
			| "EVENT_FULL"
			| "ALREADY_REGISTERED"
			| "NOT_REGISTERED",
		message: string,
	) {
		super(message);
		this.name = "EventRegistrationError";
	}
}

export async function registerForEvent(eventId: string, userId: string) {
	return db.transaction(async (tx) => {
		const [event] = await tx
			.select({
				id: events.id,
				maxSeats: events.maxSeats,
			})
			.from(events)
			.where(eq(events.id, eventId))
			.for("update");

		if (!event) {
			throw new EventRegistrationError("EVENT_NOT_FOUND", "Event not found");
		}

		const [existingRegistration] = await tx
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.eventId, eventId),
					eq(eventRegistrations.userId, userId),
				),
			);

		if (existingRegistration) {
			throw new EventRegistrationError(
				"ALREADY_REGISTERED",
				"Already registered for this event",
			);
		}

		const [registrationCountRow] = await tx
			.select({ value: count() })
			.from(eventRegistrations)
			.where(eq(eventRegistrations.eventId, eventId));

		const registrationCount = registrationCountRow?.value ?? 0;

		if (registrationCount >= event.maxSeats) {
			throw new EventRegistrationError("EVENT_FULL", "Event is full");
		}

		const [inserted] = await tx
			.insert(eventRegistrations)
			.values({
				id: crypto.randomUUID(),
				eventId,
				userId,
			})
			.onConflictDoNothing({
				target: [eventRegistrations.eventId, eventRegistrations.userId],
			})
			.returning({ id: eventRegistrations.id });

		if (!inserted) {
			throw new EventRegistrationError(
				"ALREADY_REGISTERED",
				"Already registered for this event",
			);
		}

		const txid = await getCurrentTxId(tx);

		return { txid };
	});
}

export async function unregisterFromEvent(eventId: string, userId: string) {
	return db.transaction(async (tx) => {
		const [existingRegistration] = await tx
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.eventId, eventId),
					eq(eventRegistrations.userId, userId),
				),
			);

		if (!existingRegistration) {
			throw new EventRegistrationError(
				"NOT_REGISTERED",
				"Not registered for this event",
			);
		}

		await tx
			.delete(eventRegistrations)
			.where(eq(eventRegistrations.id, existingRegistration.id));

		const txid = await getCurrentTxId(tx);

		return { txid };
	});
}

export async function getRegisteredEventIdsForUser(
	userId: string,
): Promise<string[]> {
	const rows = await db
		.select({ eventId: eventRegistrations.eventId })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.userId, userId));

	return rows.map((row) => row.eventId);
}
