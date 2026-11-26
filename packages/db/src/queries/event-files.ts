import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../client";
import { type AgendaMaterial, agendaItems } from "../schema/agenda";
import { eventFiles, storedFileDeletions } from "../schema/event-files";
import { events } from "../schema/events";
import { DomainError } from "./domain-errors";

/** Most files one event may hold (bounds its page and the bucket). */
export const EVENT_FILES_LIMIT = 50;

/** Most links one event may hold. */
export const EVENT_LINKS_LIMIT = 30;

export type EventFile = {
	id: string;
	agendaItemId: string | null;
	name: string;
	contentType: string;
	size: number;
	createdAt: Date;
};

/** What the event page shows of a file. */
export type EventFileSummary = Pick<
	EventFile,
	"id" | "name" | "size" | "agendaItemId"
>;

export type EventFileInput = {
	eventId: string;
	agendaItemId?: string | null;
	name: string;
	contentType: string;
	size: number;
	storageKey: string;
};

const fileColumns = {
	id: eventFiles.id,
	agendaItemId: eventFiles.agendaItemId,
	name: eventFiles.name,
	contentType: eventFiles.contentType,
	size: eventFiles.size,
	createdAt: eventFiles.createdAt,
};

/**
 * EVENT_FILES_LIMIT when the event is full, ITEM_NOT_FOUND for a programme item
 * of another event. The event row is locked so two uploads cannot both pass the limit.
 * Forgets the storage key recorded before the upload (`recordStoredFileDeletion`).
 */
export async function addEventFile(input: EventFileInput): Promise<EventFile> {
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`SELECT 1 FROM ${events} WHERE ${events.id} = ${input.eventId} FOR UPDATE`,
		);
		if (input.agendaItemId) {
			const [item] = await tx
				.select({ id: agendaItems.id })
				.from(agendaItems)
				.where(
					and(
						eq(agendaItems.id, input.agendaItemId),
						eq(agendaItems.eventId, input.eventId),
					),
				);
			if (!item) {
				throw new DomainError("ITEM_NOT_FOUND");
			}
		}
		const [count] = await tx
			.select({ n: sql<number>`count(*)::int` })
			.from(eventFiles)
			.where(eq(eventFiles.eventId, input.eventId));
		if ((count?.n ?? 0) >= EVENT_FILES_LIMIT) {
			throw new DomainError("EVENT_FILES_LIMIT");
		}
		const [file] = await tx
			.insert(eventFiles)
			.values({ ...input, agendaItemId: input.agendaItemId ?? null })
			.returning(fileColumns);
		if (!file) {
			throw new Error("event file insert failed");
		}
		await tx
			.delete(storedFileDeletions)
			.where(eq(storedFileDeletions.storageKey, input.storageKey));
		return file;
	});
}

export async function listEventFiles(eventId: string): Promise<EventFile[]> {
	return db
		.select(fileColumns)
		.from(eventFiles)
		.where(eq(eventFiles.eventId, eventId))
		.orderBy(asc(eventFiles.createdAt), asc(eventFiles.id));
}

/** Null when the file is not one of this event's (nothing is deleted). */
export async function deleteEventFile(
	eventId: string,
	id: string,
): Promise<{ id: string } | null> {
	const [deleted] = await db
		.delete(eventFiles)
		.where(and(eq(eventFiles.id, id), eq(eventFiles.eventId, eventId)))
		.returning({ id: eventFiles.id });
	return deleted ?? null;
}

/** For downloads: the event decides who may see it, the key where the bytes are. */
export async function getEventFile(
	id: string,
): Promise<(EventFile & { eventId: string; storageKey: string }) | null> {
	const [file] = await db
		.select({
			...fileColumns,
			eventId: eventFiles.eventId,
			storageKey: eventFiles.storageKey,
		})
		.from(eventFiles)
		.where(eq(eventFiles.id, id));
	return file ?? null;
}

/**
 * Appends one link in a single statement, so concurrent adds keep each other's.
 * EVENT_LINKS_LIMIT when the event already has the most links.
 */
export async function addEventMaterialLink(
	eventId: string,
	link: AgendaMaterial,
): Promise<void> {
	const updated = await db
		.update(events)
		.set({
			materials: sql`${events.materials} || ${JSON.stringify([link])}::jsonb`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(events.id, eventId),
				sql`jsonb_array_length(${events.materials}) < ${EVENT_LINKS_LIMIT}`,
			),
		)
		.returning({ id: events.id });
	if (updated.length > 0) {
		return;
	}
	const [event] = await db
		.select({ id: events.id })
		.from(events)
		.where(eq(events.id, eventId));
	throw new DomainError(event ? "EVENT_LINKS_LIMIT" : "EVENT_NOT_FOUND");
}

/**
 * Removes the link at `index` only while that position still holds exactly
 * `link`; false when the list changed first (nothing is removed).
 */
export async function removeEventMaterialLink(
	eventId: string,
	index: number,
	link: AgendaMaterial,
): Promise<boolean> {
	const updated = await db
		.update(events)
		.set({
			materials: sql`${events.materials} - ${index}::int`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(events.id, eventId),
				sql`${events.materials} -> ${index}::int = ${JSON.stringify(link)}::jsonb`,
			),
		)
		.returning({ id: events.id });
	return updated.length > 0;
}

/**
 * How long a recorded key waits before its object is deleted. Uploads record
 * their key before storing and forget it with the row, so an upload in
 * progress is never deleted under it.
 */
export const STORED_FILE_GRACE_MS = 60 * 60 * 1000;

/** Before an upload (forgotten with its row), or for an object stored without a row. */
export async function recordStoredFileDeletion(key: string): Promise<void> {
	await db
		.insert(storedFileDeletions)
		.values({ storageKey: key })
		.onConflictDoNothing();
}

/** Keys recorded before `before` whose objects wait to be deleted, oldest first. */
export async function takeStoredFileDeletions(
	limit: number,
	before: Date,
): Promise<string[]> {
	const rows = await db
		.select({ key: storedFileDeletions.storageKey })
		.from(storedFileDeletions)
		.where(lt(storedFileDeletions.createdAt, before))
		.orderBy(asc(storedFileDeletions.createdAt))
		.limit(limit);
	return rows.map((row) => row.key);
}

export async function forgetStoredFileDeletions(keys: string[]): Promise<void> {
	if (keys.length === 0) {
		return;
	}
	await db
		.delete(storedFileDeletions)
		.where(inArray(storedFileDeletions.storageKey, keys));
}
