import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { type AgendaMaterial, agendaItems } from "../schema/agenda";
import { eventFiles, storedFileDeletions } from "../schema/event-files";
import { events } from "../schema/events";
import { DomainError } from "./domain-errors";

/** Most files one event may hold (bounds its page and the bucket). */
export const EVENT_FILES_LIMIT = 50;

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

export async function setEventMaterialLinks(
	eventId: string,
	links: AgendaMaterial[],
): Promise<void> {
	await db
		.update(events)
		.set({ materials: links, updatedAt: new Date() })
		.where(eq(events.id, eventId));
}

/** For an object stored without a row (its insert failed). */
export async function recordStoredFileDeletion(key: string): Promise<void> {
	await db
		.insert(storedFileDeletions)
		.values({ storageKey: key })
		.onConflictDoNothing();
}

/** Keys waiting for their objects to be deleted, oldest first. */
export async function takeStoredFileDeletions(
	limit: number,
): Promise<string[]> {
	const rows = await db
		.select({ key: storedFileDeletions.storageKey })
		.from(storedFileDeletions)
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
