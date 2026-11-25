import { and, asc, eq, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import {
	type AgendaSessionColor,
	agendaItems,
	agendaSessions,
} from "../schema/agenda";
import { eventLocations } from "../schema/event-lookups";
import { DomainError } from "./domain-errors";

export type { AgendaSessionColor } from "../schema/agenda";

/** A part of an event's programme with its own theme, place and time (F33). */
export type AgendaSession = {
	id: string;
	eventId: string;
	title: string;
	description: string | null;
	color: AgendaSessionColor;
	locationId: string | null;
	locationLabel: string | null;
	startsAt: Date;
	endsAt: Date;
};

export type AgendaSessionInput = {
	eventId: string;
	title: string;
	description?: string | null;
	color?: AgendaSessionColor;
	locationId?: string | null;
	startsAt: Date;
	endsAt: Date;
};

function selectSessions(client: DbExecutor) {
	return client
		.select({
			id: agendaSessions.id,
			eventId: agendaSessions.eventId,
			title: agendaSessions.title,
			description: agendaSessions.description,
			color: agendaSessions.color,
			locationId: agendaSessions.locationId,
			locationLabel: eventLocations.label,
			startsAt: agendaSessions.startsAt,
			endsAt: agendaSessions.endsAt,
		})
		.from(agendaSessions)
		.leftJoin(eventLocations, eq(agendaSessions.locationId, eventLocations.id));
}

async function getSession(
	client: DbExecutor,
	id: string,
): Promise<AgendaSession> {
	const [row] = await selectSessions(client).where(eq(agendaSessions.id, id));
	if (!row) {
		throw new DomainError("SESSION_NOT_FOUND");
	}
	return row;
}

function assertOrdered(startsAt: Date, endsAt: Date) {
	if (endsAt <= startsAt) {
		throw new DomainError("END_BEFORE_START");
	}
}

export async function listAgendaSessions(
	eventId: string,
): Promise<AgendaSession[]> {
	return selectSessions(db)
		.where(eq(agendaSessions.eventId, eventId))
		.orderBy(asc(agendaSessions.startsAt), asc(agendaSessions.title));
}

export async function createAgendaSession(
	input: AgendaSessionInput,
): Promise<AgendaSession> {
	assertOrdered(input.startsAt, input.endsAt);
	return db.transaction(async (tx) => {
		const [inserted] = await tx
			.insert(agendaSessions)
			.values({
				eventId: input.eventId,
				title: input.title,
				description: input.description ?? null,
				color: input.color ?? "blue",
				locationId: input.locationId ?? null,
				startsAt: input.startsAt,
				endsAt: input.endsAt,
			})
			.returning({ id: agendaSessions.id });
		if (!inserted) {
			throw new Error("Agenda session insert failed");
		}
		return getSession(tx, inserted.id);
	});
}

/** Locks the session row (items check against it under the same lock); null when unknown. */
async function lockSession(tx: TransactionClient, id: string) {
	const [row] = await tx.execute<{ starts_at: string; ends_at: string }>(
		sql`SELECT starts_at, ends_at FROM ${agendaSessions} WHERE ${agendaSessions.id} = ${id} FOR UPDATE`,
	);
	return row
		? { startsAt: new Date(row.starts_at), endsAt: new Date(row.ends_at) }
		: null;
}

/**
 * Moving the start moves the programme with it (items keep their offset from the
 * start). SESSION_ITEMS_OUTSIDE when the new times would still leave an item outside.
 */
export async function updateAgendaSession(
	id: string,
	input: Partial<Omit<AgendaSessionInput, "eventId">>,
): Promise<AgendaSession | null> {
	return db.transaction(async (tx) => {
		const current = await lockSession(tx, id);
		if (!current) {
			return null;
		}
		const startsAt = input.startsAt ?? current.startsAt;
		const endsAt = input.endsAt ?? current.endsAt;
		assertOrdered(startsAt, endsAt);
		const shift = sql`make_interval(secs => ${(startsAt.getTime() - current.startsAt.getTime()) / 1000})`;
		const [outside] = await tx
			.select({ id: agendaItems.id })
			.from(agendaItems)
			.where(
				and(
					eq(agendaItems.sessionId, id),
					sql`(${agendaItems.startsAt} + ${shift} < ${startsAt.toISOString()}::timestamptz
						OR ${agendaItems.endsAt} + ${shift} > ${endsAt.toISOString()}::timestamptz)`,
				),
			)
			.limit(1);
		if (outside) {
			throw new DomainError("SESSION_ITEMS_OUTSIDE");
		}
		if (startsAt.getTime() !== current.startsAt.getTime()) {
			await tx
				.update(agendaItems)
				.set({
					startsAt: sql`${agendaItems.startsAt} + ${shift}`,
					endsAt: sql`${agendaItems.endsAt} + ${shift}`,
					updatedAt: new Date(),
				})
				.where(eq(agendaItems.sessionId, id));
		}
		await tx
			.update(agendaSessions)
			.set({ ...input, updatedAt: new Date() })
			.where(eq(agendaSessions.id, id));
		return getSession(tx, id);
	});
}

/** Deletes the session and its programme (items cascade, with their registrations). */
export async function deleteAgendaSession(
	id: string,
): Promise<{ id: string } | null> {
	const [deleted] = await db
		.delete(agendaSessions)
		.where(eq(agendaSessions.id, id))
		.returning({ id: agendaSessions.id });
	return deleted ?? null;
}

/** The event a session belongs to, or null when the session doesn't exist. */
export async function getAgendaSessionEventId(
	id: string,
): Promise<string | null> {
	const [row] = await db
		.select({ eventId: agendaSessions.eventId })
		.from(agendaSessions)
		.where(eq(agendaSessions.id, id));
	return row?.eventId ?? null;
}

/**
 * An independent copy of the session starting at `startsAt`: same duration, theme and
 * programme (each item keeps its offset from the start). Items in the session's own
 * location move to the copy's location. Registrations and files are not copied.
 */
export async function copyAgendaSession(
	id: string,
	options: { startsAt: Date; locationId?: string | null; title?: string },
): Promise<AgendaSession> {
	return db.transaction(async (tx) => {
		const [source] = await tx
			.select()
			.from(agendaSessions)
			.where(eq(agendaSessions.id, id));
		if (!source) {
			throw new DomainError("SESSION_NOT_FOUND");
		}
		const shift = options.startsAt.getTime() - source.startsAt.getTime();
		const moved = (time: Date) => new Date(time.getTime() + shift);
		const locationId =
			options.locationId === undefined ? source.locationId : options.locationId;
		const [copy] = await tx
			.insert(agendaSessions)
			.values({
				eventId: source.eventId,
				title: options.title ?? source.title,
				description: source.description,
				color: source.color,
				locationId,
				startsAt: moved(source.startsAt),
				endsAt: moved(source.endsAt),
			})
			.returning({ id: agendaSessions.id });
		if (!copy) {
			throw new Error("Agenda session copy failed");
		}
		const items = await tx
			.select()
			.from(agendaItems)
			.where(eq(agendaItems.sessionId, id));
		if (items.length > 0) {
			await tx.insert(agendaItems).values(
				items.map((item) => ({
					eventId: item.eventId,
					sessionId: copy.id,
					title: item.title,
					description: item.description,
					startsAt: moved(item.startsAt),
					endsAt: moved(item.endsAt),
					locationId:
						item.locationId === source.locationId
							? locationId
							: item.locationId,
					maxSeats: item.maxSeats,
					requiresRegistration: item.requiresRegistration,
					speakers: item.speakers,
					materials: item.materials,
					typeId: item.typeId,
					facultyId: item.facultyId,
					topic: item.topic,
					audience: item.audience,
					languages: item.languages,
				})),
			);
		}
		return getSession(tx, copy.id);
	});
}
