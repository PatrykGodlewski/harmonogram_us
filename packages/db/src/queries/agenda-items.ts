import { asc, eq, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import {
	type AgendaMaterial,
	type AgendaSpeaker,
	agendaItemSeatCounts,
	agendaItems,
	agendaSessions,
} from "../schema/agenda";
import { eventLocations } from "../schema/event-lookups";
import { events } from "../schema/events";
import {
	CAPACITY_EDIT_ERRORS,
	DomainError,
	mapConstraintError,
} from "./domain-errors";

export type AgendaItem = {
	id: string;
	eventId: string;
	/** The session the item belongs to (F33), or null outside any session. */
	sessionId: string | null;
	title: string;
	description: string | null;
	startsAt: Date;
	endsAt: Date;
	locationId: string | null;
	locationLabel: string | null;
	maxSeats: number | null;
	requiresRegistration: boolean;
	speakers: AgendaSpeaker[];
	materials: AgendaMaterial[];
	seatsRemaining: number | null;
	registeredCount: number;
};

export type AgendaItemInput = {
	eventId: string;
	sessionId?: string | null;
	title: string;
	description?: string | null;
	startsAt: Date;
	endsAt: Date;
	locationId?: string | null;
	maxSeats?: number | null;
	requiresRegistration?: boolean;
	speakers?: AgendaSpeaker[];
	materials?: AgendaMaterial[];
};

function selectAgendaItems(client: DbExecutor) {
	return client
		.select({
			id: agendaItems.id,
			eventId: agendaItems.eventId,
			sessionId: agendaItems.sessionId,
			title: agendaItems.title,
			description: agendaItems.description,
			startsAt: agendaItems.startsAt,
			endsAt: agendaItems.endsAt,
			locationId: agendaItems.locationId,
			locationLabel: eventLocations.label,
			maxSeats: agendaItems.maxSeats,
			requiresRegistration: agendaItems.requiresRegistration,
			speakers: agendaItems.speakers,
			materials: agendaItems.materials,
			seatsRemaining: agendaItemSeatCounts.seatsRemaining,
			registeredCount: agendaItemSeatCounts.registeredCount,
		})
		.from(agendaItems)
		.leftJoin(eventLocations, eq(agendaItems.locationId, eventLocations.id))
		.leftJoin(
			agendaItemSeatCounts,
			eq(agendaItems.id, agendaItemSeatCounts.agendaItemId),
		);
}

function normalize(row: Awaited<ReturnType<typeof selectAgendaItems>>[number]) {
	return { ...row, registeredCount: row.registeredCount ?? 0 };
}

export async function listAgendaItems(eventId: string): Promise<AgendaItem[]> {
	const rows = await selectAgendaItems(db)
		.where(eq(agendaItems.eventId, eventId))
		.orderBy(asc(agendaItems.startsAt), asc(agendaItems.title));
	return rows.map(normalize);
}

async function getAgendaItem(
	client: DbExecutor,
	id: string,
): Promise<AgendaItem | null> {
	const [row] = await selectAgendaItems(client).where(eq(agendaItems.id, id));
	return row ? normalize(row) : null;
}

async function assertWithinEventLimit(
	tx: TransactionClient,
	eventId: string,
	maxSeats: number | null | undefined,
) {
	if (maxSeats === null || maxSeats === undefined) {
		return;
	}
	const [event] = await tx
		.select({ maxSeats: events.maxSeats })
		.from(events)
		.where(eq(events.id, eventId));
	if (event && maxSeats > event.maxSeats) {
		throw new DomainError("ITEM_LIMIT_ABOVE_EVENT");
	}
}

/**
 * SESSION_NOT_FOUND for a session of another event; ITEM_OUTSIDE_SESSION when the item
 * does not fit in the session's times. Locks the session row, so a session's times and
 * its items cannot change past each other.
 */
async function assertFitsSession(
	tx: TransactionClient,
	eventId: string,
	sessionId: string,
	startsAt: Date,
	endsAt: Date,
) {
	const [session] = await tx.execute<{ starts_at: string; ends_at: string }>(
		sql`SELECT starts_at, ends_at FROM ${agendaSessions}
			WHERE ${agendaSessions.id} = ${sessionId} AND ${agendaSessions.eventId} = ${eventId}
			FOR UPDATE`,
	);
	if (!session) {
		throw new DomainError("SESSION_NOT_FOUND");
	}
	if (
		startsAt < new Date(session.starts_at) ||
		endsAt > new Date(session.ends_at)
	) {
		throw new DomainError("ITEM_OUTSIDE_SESSION");
	}
}

export async function createAgendaItem(
	input: AgendaItemInput,
): Promise<AgendaItem> {
	try {
		return await db.transaction(async (tx) => {
			await assertWithinEventLimit(tx, input.eventId, input.maxSeats);
			if (input.sessionId) {
				await assertFitsSession(
					tx,
					input.eventId,
					input.sessionId,
					input.startsAt,
					input.endsAt,
				);
			}
			const [inserted] = await tx
				.insert(agendaItems)
				.values({
					eventId: input.eventId,
					sessionId: input.sessionId ?? null,
					title: input.title,
					description: input.description ?? null,
					startsAt: input.startsAt,
					endsAt: input.endsAt,
					locationId: input.locationId ?? null,
					maxSeats: input.maxSeats ?? null,
					requiresRegistration: input.requiresRegistration ?? true,
					speakers: input.speakers ?? [],
					materials: input.materials ?? [],
				})
				.returning({ id: agendaItems.id });
			const item = inserted ? await getAgendaItem(tx, inserted.id) : null;
			if (!item) {
				throw new Error("Agenda item insert failed");
			}
			return item;
		});
	} catch (error) {
		mapConstraintError(error, CAPACITY_EDIT_ERRORS);
	}
}

export async function updateAgendaItem(
	id: string,
	input: Partial<Omit<AgendaItemInput, "eventId">>,
): Promise<AgendaItem | null> {
	try {
		return await db.transaction(async (tx) => {
			const [existing] = await tx
				.select({
					eventId: agendaItems.eventId,
					sessionId: agendaItems.sessionId,
					startsAt: agendaItems.startsAt,
					endsAt: agendaItems.endsAt,
				})
				.from(agendaItems)
				.where(eq(agendaItems.id, id));
			if (!existing) {
				return null;
			}
			await assertWithinEventLimit(tx, existing.eventId, input.maxSeats);
			const sessionId =
				input.sessionId === undefined ? existing.sessionId : input.sessionId;
			if (sessionId) {
				await assertFitsSession(
					tx,
					existing.eventId,
					sessionId,
					input.startsAt ?? existing.startsAt,
					input.endsAt ?? existing.endsAt,
				);
			}
			await tx
				.update(agendaItems)
				.set({ ...input, updatedAt: new Date() })
				.where(eq(agendaItems.id, id));
			return getAgendaItem(tx, id);
		});
	} catch (error) {
		mapConstraintError(error, CAPACITY_EDIT_ERRORS);
	}
}

export async function deleteAgendaItem(
	id: string,
): Promise<{ id: string } | null> {
	const [deleted] = await db
		.delete(agendaItems)
		.where(eq(agendaItems.id, id))
		.returning({ id: agendaItems.id });
	return deleted ?? null;
}

/** The event an agenda item belongs to, or null when the item doesn't exist. */
export async function getAgendaItemEventId(
	itemId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ eventId: agendaItems.eventId })
		.from(agendaItems)
		.where(eq(agendaItems.id, itemId));
	return row?.eventId ?? null;
}
