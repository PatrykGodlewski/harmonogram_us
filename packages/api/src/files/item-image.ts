/** Server-only: a programme item's image (F18) — upload checks, the bucket, and serving it inline. */
import { randomUUID } from "node:crypto";
import {
	getAgendaItemImage,
	setAgendaItemImage,
} from "@repo/db/queries/agenda-items";
import { DomainError } from "@repo/db/queries/domain-errors";
import {
	forgetStoredFileDeletions,
	recordStoredFileDeletion,
} from "@repo/db/queries/event-files";
import {
	deleteObject,
	presignDownload,
	putObject,
	type StorageConfig,
	storageConfig,
} from "../storage/s3";
import { fileDownloadResponse, managerCanSee, visitorCanSee } from "./download";
import { imageTypeFor, MAX_IMAGE_BYTES } from "./image-rules";

export type ItemImageDeps = {
	config: StorageConfig | null;
	put: typeof putObject;
	remove: typeof deleteObject;
	presign: typeof presignDownload;
};

const defaultDeps = (): ItemImageDeps => ({
	config: storageConfig(),
	put: putObject,
	remove: deleteObject,
	presign: presignDownload,
});

/**
 * Stores the image and sets it on the item; the previous one is queued for deletion
 * (trigger). Refuses other types and images over 5 MB before storing anything. The
 * key is recorded for deletion before the upload and forgotten when the image is set.
 */
export async function storeAgendaItemImage(
	input: { itemId: string; file: File; alt: string },
	deps: ItemImageDeps = defaultDeps(),
): Promise<void> {
	if (!deps.config) {
		throw new DomainError("FILES_NOT_CONFIGURED");
	}
	const contentType = imageTypeFor(input.file.name);
	if (!contentType) {
		throw new DomainError("IMAGE_TYPE");
	}
	if (input.file.size > MAX_IMAGE_BYTES) {
		throw new DomainError("IMAGE_TOO_LARGE");
	}
	const item = await getAgendaItemImage(input.itemId);
	if (!item) {
		throw new DomainError("ITEM_NOT_FOUND");
	}
	const key = `events/${item.eventId}/items/${input.itemId}-${randomUUID()}`;
	const bytes = await input.file.arrayBuffer();
	await recordStoredFileDeletion(key);
	await deps.put(deps.config, key, bytes, contentType);
	const config = deps.config;
	// When the delete fails, the recorded key stays for the worker.
	const removeStored = () =>
		deps.remove(config, key).then(
			() => forgetStoredFileDeletions([key]),
			() => {},
		);
	let set: boolean;
	try {
		set = await setAgendaItemImage(input.itemId, { key, alt: input.alt });
	} catch (error) {
		await removeStored();
		throw error;
	}
	if (!set) {
		// Deleted meanwhile.
		await removeStored();
		throw new DomainError("ITEM_NOT_FOUND");
	}
}

/** 302 to an inline signed link when `canSee` allows the item's event; 404 otherwise. */
export function agendaItemImageResponse(
	itemId: string,
	canSee: (eventId: string) => Promise<boolean>,
	deps: ItemImageDeps = defaultDeps(),
): Promise<Response> {
	return fileDownloadResponse(itemId, canSee, {
		config: deps.config,
		getFile: async (id) => {
			const item = await getAgendaItemImage(id);
			return item?.imageKey
				? { eventId: item.eventId, storageKey: item.imageKey, name: "image" }
				: null;
		},
		presign: (config, key, name) =>
			deps.presign(config, key, name, { inline: true }),
	});
}

/** On the public site, under the event page's rules (`invite` for invite-only events). */
export async function publicItemImageResponse(
	itemId: string,
	invite: string | undefined,
): Promise<Response> {
	return agendaItemImageResponse(itemId, await visitorCanSee(invite));
}

/** In the panel, for the event's managers. */
export async function panelItemImageResponse(
	itemId: string,
): Promise<Response> {
	return agendaItemImageResponse(itemId, await managerCanSee());
}
