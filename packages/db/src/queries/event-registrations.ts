import { and, asc, eq, max, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import { authUsers } from "../schema/better-auth";
import {
	eventRegistrations,
	eventSeatCounts,
} from "../schema/event-registrations";
import { events } from "../schema/events";
import { registrationGroups } from "../schema/groups";
import {
	DomainError,
	mapConstraintError,
	REGISTRATION_ERRORS,
} from "./domain-errors";
import { lockEvent } from "./locks";
import { getCurrentTxId } from "./txid";

export async function getEffectiveEventEnd(
	tx: DbExecutor,
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

export async function assertEventOpen(tx: TransactionClient, eventId: string) {
	const end = await getEffectiveEventEnd(tx, eventId);
	if (end && end.getTime() <= Date.now()) {
		throw new DomainError("EVENT_ENDED");
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
		throw new DomainError("EVENT_FULL");
	}

	const id = crypto.randomUUID();
	await tx.insert(eventRegistrations).values({ id, eventId, userId });
	return id;
}

export async function registerForEvent(eventId: string, userId: string) {
	try {
		return await db.transaction(async (tx) => {
			if (!(await lockEvent(tx, eventId))) {
				throw new DomainError("EVENT_NOT_FOUND");
			}
			await assertEventOpen(tx, eventId);

			if (await findEventRegistrationId(tx, eventId, userId)) {
				throw new DomainError("ALREADY_REGISTERED");
			}

			await insertEventRegistration(tx, eventId, userId);
			return { txid: await getCurrentTxId(tx) };
		});
	} catch (error) {
		mapConstraintError(error, REGISTRATION_ERRORS);
	}
}

export async function registerForAgendaItem(
	itemId: string,
	userId: string,
): Promise<{ txid: number; eventRegistered: boolean }> {
	try {
		return await db.transaction(async (tx) => {
			// Global lock order: event row, then items (by id), then group/member rows, then count rows.
			const [peek] = await tx
				.select({ eventId: agendaItems.eventId })
				.from(agendaItems)
				.where(eq(agendaItems.id, itemId));
			if (!peek) {
				throw new DomainError("ITEM_NOT_FOUND");
			}
			await lockEvent(tx, peek.eventId);
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
				throw new DomainError("ITEM_NOT_FOUND");
			}
			if (!item.requiresRegistration) {
				throw new DomainError("ITEM_NOT_REGISTRABLE");
			}

			await assertEventOpen(tx, item.eventId);

			if (item.endsAt.getTime() <= Date.now()) {
				throw new DomainError("ITEM_ENDED");
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
				throw new DomainError("ALREADY_REGISTERED");
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
					throw new DomainError("ITEM_FULL");
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
		mapConstraintError(error, REGISTRATION_ERRORS);
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
			throw new DomainError("NOT_REGISTERED");
		}

		return { txid: await getCurrentTxId(tx) };
	});
}

export async function unregisterFromEvent(eventId: string, userId: string) {
	return db.transaction(async (tx) => {
		const existingId = await findEventRegistrationId(tx, eventId, userId);
		if (!existingId) {
			throw new DomainError("NOT_REGISTERED");
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

export type EventRegistrant = {
	registrationId: string;
	userId: string;
	email: string;
	name: string | null;
	registeredAt: Date;
	agendaItemIds: string[];
	groupId: string | null;
	groupName: string | null;
};

export async function getEventRegistrants(
	eventId: string,
): Promise<EventRegistrant[]> {
	const rows = await db
		.select({
			registrationId: eventRegistrations.id,
			userId: eventRegistrations.userId,
			email: authUsers.email,
			name: authUsers.name,
			registeredAt: eventRegistrations.createdAt,
			groupId: eventRegistrations.groupId,
			groupName: registrationGroups.name,
			agendaItemIds: sql<string[]>`coalesce(
				array_agg(${agendaItemRegistrations.agendaItemId})
					filter (where ${agendaItemRegistrations.agendaItemId} is not null),
				'{}'
			)`,
		})
		.from(eventRegistrations)
		.innerJoin(authUsers, eq(eventRegistrations.userId, authUsers.id))
		.leftJoin(
			registrationGroups,
			eq(registrationGroups.id, eventRegistrations.groupId),
		)
		.leftJoin(
			agendaItemRegistrations,
			eq(agendaItemRegistrations.eventRegistrationId, eventRegistrations.id),
		)
		.where(eq(eventRegistrations.eventId, eventId))
		.groupBy(eventRegistrations.id, authUsers.id, registrationGroups.id)
		.orderBy(asc(eventRegistrations.createdAt));

	return rows;
}
