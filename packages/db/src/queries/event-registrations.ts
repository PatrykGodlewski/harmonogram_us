import { and, eq, max, sql } from "drizzle-orm";
import { db } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import {
	eventRegistrations,
	eventSeatCounts,
} from "../schema/event-registrations";
import { events } from "../schema/events";
import { getCurrentTxId } from "./txid";

export type RegistrationErrorCode =
	| "EVENT_NOT_FOUND"
	| "EVENT_FULL"
	| "EVENT_ENDED"
	| "ALREADY_REGISTERED"
	| "NOT_REGISTERED"
	| "ITEM_NOT_FOUND"
	| "ITEM_FULL"
	| "ITEM_NOT_REGISTRABLE"
	| "ITEM_ENDED"
	| "ITEM_LIMIT_ABOVE_EVENT"
	| "MAX_SEATS_BELOW_REGISTERED";

export class EventRegistrationError extends Error {
	constructor(
		readonly code: RegistrationErrorCode,
		message: string = code,
	) {
		super(message);
		this.name = "EventRegistrationError";
	}
}

type DbClient = typeof db;
type TransactionClient = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

const EVENT_SEATS_CONSTRAINT = "event_seat_counts_seats_remaining_nonnegative";
const ITEM_SEATS_CONSTRAINT =
	"agenda_item_seat_counts_seats_remaining_nonnegative";

type PgErrorFields = { code?: string; constraint_name?: string };

function findPgError(error: unknown): PgErrorFields | null {
	let current: unknown = error;
	while (current && typeof current === "object") {
		if ("constraint_name" in current || "severity" in current) {
			return current as PgErrorFields;
		}
		current = (current as { cause?: unknown }).cause;
	}
	return null;
}

/**
 * Translates database constraint violations into domain errors.
 * `context` decides what a seat CHECK means: a registration that would
 * oversell (`register`) or a capacity edit below the registered count
 * (`capacity`). Rethrows anything it doesn't recognise.
 */
export function mapConstraintError(
	error: unknown,
	context: "register" | "capacity",
): never {
	if (error instanceof EventRegistrationError) {
		throw error;
	}

	const pg = findPgError(error);
	if (pg?.code === "23514") {
		if (context === "capacity") {
			throw new EventRegistrationError("MAX_SEATS_BELOW_REGISTERED");
		}
		if (pg.constraint_name === EVENT_SEATS_CONSTRAINT) {
			throw new EventRegistrationError("EVENT_FULL");
		}
		if (pg.constraint_name === ITEM_SEATS_CONSTRAINT) {
			throw new EventRegistrationError("ITEM_FULL");
		}
	}
	if (pg?.code === "23505" && context === "register") {
		throw new EventRegistrationError("ALREADY_REGISTERED");
	}

	throw error;
}

export async function getEffectiveEventEnd(
	tx: TransactionClient | DbClient,
	eventId: string,
): Promise<Date | null> {
	const [row] = await tx
		.select({
			endsAt: events.endsAt,
			date: events.date,
			lastItemEnd: max(agendaItems.endsAt),
		})
		.from(events)
		.leftJoin(agendaItems, eq(agendaItems.eventId, events.id))
		.where(eq(events.id, eventId))
		.groupBy(events.id);

	if (!row) {
		return null;
	}
	if (row.endsAt) {
		return row.endsAt;
	}
	if (row.lastItemEnd) {
		return new Date(row.lastItemEnd);
	}
	return new Date(row.date.getTime() + 24 * 60 * 60 * 1000);
}

async function assertEventOpen(tx: TransactionClient, eventId: string) {
	const end = await getEffectiveEventEnd(tx, eventId);
	if (end && end.getTime() <= Date.now()) {
		throw new EventRegistrationError("EVENT_ENDED");
	}
}

async function findEventRegistrationId(
	tx: TransactionClient,
	eventId: string,
	userId: string,
): Promise<string | null> {
	const [row] = await tx
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	return row?.id ?? null;
}

/** Inserts an event registration after checking capacity. Caller holds the event row lock. */
async function insertEventRegistration(
	tx: TransactionClient,
	eventId: string,
	userId: string,
): Promise<string> {
	const [count] = await tx
		.select({ seatsRemaining: eventSeatCounts.seatsRemaining })
		.from(eventSeatCounts)
		.where(eq(eventSeatCounts.eventId, eventId));

	if (count && count.seatsRemaining <= 0) {
		throw new EventRegistrationError("EVENT_FULL");
	}

	const id = crypto.randomUUID();
	await tx.insert(eventRegistrations).values({ id, eventId, userId });
	return id;
}

async function lockEvent(tx: TransactionClient, eventId: string) {
	const [event] = await tx
		.select({ id: events.id })
		.from(events)
		.where(eq(events.id, eventId))
		.for("update");
	return event ?? null;
}

export async function registerForEvent(eventId: string, userId: string) {
	try {
		return await db.transaction(async (tx) => {
			if (!(await lockEvent(tx, eventId))) {
				throw new EventRegistrationError("EVENT_NOT_FOUND");
			}
			await assertEventOpen(tx, eventId);

			if (await findEventRegistrationId(tx, eventId, userId)) {
				throw new EventRegistrationError("ALREADY_REGISTERED");
			}

			await insertEventRegistration(tx, eventId, userId);
			return { txid: await getCurrentTxId(tx) };
		});
	} catch (error) {
		mapConstraintError(error, "register");
	}
}

export async function registerForAgendaItem(
	itemId: string,
	userId: string,
): Promise<{ txid: number; eventRegistered: boolean }> {
	try {
		return await db.transaction(async (tx) => {
			// Lock order: item, then event (avoids deadlocks with other item registrations).
			const [item] = await tx
				.select({
					id: agendaItems.id,
					eventId: agendaItems.eventId,
					endsAt: agendaItems.endsAt,
					maxSeats: agendaItems.maxSeats,
					requiresRegistration: agendaItems.requiresRegistration,
				})
				.from(agendaItems)
				.where(eq(agendaItems.id, itemId))
				.for("update");

			if (!item) {
				throw new EventRegistrationError("ITEM_NOT_FOUND");
			}
			if (!item.requiresRegistration) {
				throw new EventRegistrationError("ITEM_NOT_REGISTRABLE");
			}

			await lockEvent(tx, item.eventId);
			await assertEventOpen(tx, item.eventId);

			if (item.endsAt.getTime() <= Date.now()) {
				throw new EventRegistrationError("ITEM_ENDED");
			}

			const [existing] = await tx
				.select({ id: agendaItemRegistrations.id })
				.from(agendaItemRegistrations)
				.where(
					and(
						eq(agendaItemRegistrations.agendaItemId, itemId),
						eq(agendaItemRegistrations.userId, userId),
					),
				);
			if (existing) {
				throw new EventRegistrationError("ALREADY_REGISTERED");
			}

			let eventRegistrationId = await findEventRegistrationId(
				tx,
				item.eventId,
				userId,
			);
			const eventRegistered = eventRegistrationId === null;
			if (eventRegistrationId === null) {
				eventRegistrationId = await insertEventRegistration(
					tx,
					item.eventId,
					userId,
				);
			}

			if (item.maxSeats !== null) {
				const [registered] = await tx
					.select({ n: sql<number>`count(*)::int` })
					.from(agendaItemRegistrations)
					.where(eq(agendaItemRegistrations.agendaItemId, itemId));
				if ((registered?.n ?? 0) >= item.maxSeats) {
					throw new EventRegistrationError("ITEM_FULL");
				}
			}

			await tx.insert(agendaItemRegistrations).values({
				id: crypto.randomUUID(),
				agendaItemId: itemId,
				eventRegistrationId,
				userId,
			});

			return { txid: await getCurrentTxId(tx), eventRegistered };
		});
	} catch (error) {
		mapConstraintError(error, "register");
	}
}

export async function unregisterFromAgendaItem(
	itemId: string,
	userId: string,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		const [deleted] = await tx
			.delete(agendaItemRegistrations)
			.where(
				and(
					eq(agendaItemRegistrations.agendaItemId, itemId),
					eq(agendaItemRegistrations.userId, userId),
				),
			)
			.returning({ id: agendaItemRegistrations.id });

		if (!deleted) {
			throw new EventRegistrationError("NOT_REGISTERED");
		}

		return { txid: await getCurrentTxId(tx) };
	});
}

export async function unregisterFromEvent(eventId: string, userId: string) {
	return db.transaction(async (tx) => {
		const existingId = await findEventRegistrationId(tx, eventId, userId);
		if (!existingId) {
			throw new EventRegistrationError("NOT_REGISTERED");
		}

		// Item registrations cascade via event_registration_id.
		await tx
			.delete(eventRegistrations)
			.where(eq(eventRegistrations.id, existingId));

		return { txid: await getCurrentTxId(tx) };
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

export async function getMyRegistrations(
	userId: string,
): Promise<{ eventIds: string[]; agendaItemIds: string[] }> {
	const [eventIds, itemRows] = await Promise.all([
		getRegisteredEventIdsForUser(userId),
		db
			.select({ agendaItemId: agendaItemRegistrations.agendaItemId })
			.from(agendaItemRegistrations)
			.where(eq(agendaItemRegistrations.userId, userId)),
	]);

	return {
		eventIds,
		agendaItemIds: itemRows.map((row) => row.agendaItemId),
	};
}
