/** Server-only: adding an event file — checks, bytes to the bucket, then the row. */
import { randomUUID } from "node:crypto";
import { getAgendaItemEventId } from "@repo/db/queries/agenda-items";
import { DomainError } from "@repo/db/queries/domain-errors";
import {
	addEventFile,
	EVENT_FILES_LIMIT,
	type EventFile,
	forgetStoredFileDeletions,
	listEventFiles,
	recordStoredFileDeletion,
} from "@repo/db/queries/event-files";
import {
	deleteObject,
	putObject,
	type StorageConfig,
	storageConfig,
} from "../storage/s3";
import { cleanFileName, fileTypeFor, MAX_FILE_BYTES } from "./rules";

export type StoreFileDeps = {
	config: StorageConfig | null;
	put: typeof putObject;
	remove: typeof deleteObject;
};

const defaultDeps = (): StoreFileDeps => ({
	config: storageConfig(),
	put: putObject,
	remove: deleteObject,
});

/**
 * Refuses (before storing anything) disallowed types, files over 25 MB, full
 * events and another event's programme item. The key is recorded for deletion
 * before the upload and forgotten with the row, so an upload that never gets
 * its row is cleaned up by the worker. When the row cannot be added, the object
 * is removed at once, or left to the worker if that fails too.
 */
export async function storeEventFile(
	input: { eventId: string; agendaItemId?: string | null; file: File },
	deps: StoreFileDeps = defaultDeps(),
): Promise<EventFile> {
	if (!deps.config) {
		throw new DomainError("FILES_NOT_CONFIGURED");
	}
	const name = cleanFileName(input.file.name);
	const contentType = fileTypeFor(name);
	if (!contentType) {
		throw new DomainError("FILE_TYPE");
	}
	if (input.file.size > MAX_FILE_BYTES) {
		throw new DomainError("FILE_TOO_LARGE");
	}
	if ((await listEventFiles(input.eventId)).length >= EVENT_FILES_LIMIT) {
		throw new DomainError("EVENT_FILES_LIMIT");
	}
	if (
		input.agendaItemId &&
		(await getAgendaItemEventId(input.agendaItemId)) !== input.eventId
	) {
		throw new DomainError("ITEM_NOT_FOUND");
	}
	const storageKey = `events/${input.eventId}/${randomUUID()}`;
	const bytes = await input.file.arrayBuffer();
	await recordStoredFileDeletion(storageKey);
	await deps.put(deps.config, storageKey, bytes, contentType);
	try {
		return await addEventFile({
			eventId: input.eventId,
			agendaItemId: input.agendaItemId,
			name,
			contentType,
			size: bytes.byteLength,
			storageKey,
		});
	} catch (error) {
		await deps.remove(deps.config, storageKey).then(
			() => forgetStoredFileDeletions([storageKey]),
			() => {},
		);
		throw error;
	}
}
