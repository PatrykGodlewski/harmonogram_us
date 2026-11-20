import { asc, eq } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { agendaItemSeatCounts, agendaItems } from "../schema/agenda";
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
	title: string;
	description: string | null;
	startsAt: Date;
	endsAt: Date;
	locationId: string | null;
	locationLabel: string | null;
	maxSeats: number | null;
	requiresRegistration: boolean;
	seatsRemaining: number | null;
	registeredCount: number;
};

export type AgendaItemInput = {
	eventId: string;
	title: string;
	description?: string | null;
	startsAt: Date;
	endsAt: Date;
	locationId?: string | null;
	maxSeats?: number | null;
	requiresRegistration?: boolean;
};

function selectAgendaItems(client: DbExecutor) {
	return client
		.select({
			id: agendaItems.id,
			eventId: agendaItems.eventId,
			title: agendaItems.title,
			description: agendaItems.description,
			startsAt: agendaItems.startsAt,
			endsAt: agendaItems.endsAt,
			locationId: agendaItems.locationId,
			locationLabel: eventLocations.label,
			maxSeats: agendaItems.maxSeats,
			requiresRegistration: agendaItems.requiresRegistration,
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

export async function createAgendaItem(
	input: AgendaItemInput,
): Promise<AgendaItem> {
	try {
		return await db.transaction(async (tx) => {
			await assertWithinEventLimit(tx, input.eventId, input.maxSeats);
			const [inserted] = await tx
				.insert(agendaItems)
				.values({
					eventId: input.eventId,
					title: input.title,
					description: input.description ?? null,
					startsAt: input.startsAt,
					endsAt: input.endsAt,
					locationId: input.locationId ?? null,
					maxSeats: input.maxSeats ?? null,
					requiresRegistration: input.requiresRegistration ?? true,
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
				.select({ eventId: agendaItems.eventId })
				.from(agendaItems)
				.where(eq(agendaItems.id, id));
			if (!existing) {
				return null;
			}
			await assertWithinEventLimit(tx, existing.eventId, input.maxSeats);
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
