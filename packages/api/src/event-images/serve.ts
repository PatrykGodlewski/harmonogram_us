/** Server-only: serving an event's cover image — a signed bucket link, or the local file. */
import { readFile } from "node:fs/promises";
import { getReadyEventImageKey } from "@repo/db/queries/event-images";
import { managerCanSee, visitorCanSee } from "../files/download";
import {
	presignDownload,
	type StorageConfig,
	storageConfig,
} from "../storage/s3";
import { sniffImageType } from "./providers";
import { eventImageDir, localEventImagePath } from "./store";

export type EventImageServeDeps = {
	config: StorageConfig | null;
	getKey: (eventId: string) => Promise<string | null>;
	presign: typeof presignDownload;
	/** Used when `config` is null; null when no directory is set either. */
	dir: string | null;
};

const defaultDeps = (): EventImageServeDeps => ({
	config: storageConfig(),
	getKey: getReadyEventImageKey,
	presign: presignDownload,
	dir: eventImageDir(),
});

const HEADERS = { "cache-control": "private, no-store" };

const NOT_FOUND = () =>
	new Response("Not found", { status: 404, headers: HEADERS });

async function readLocalImage(
	key: string,
	dir: string,
): Promise<ArrayBuffer | null> {
	try {
		// A copy into its own buffer (a file read may share a pooled one).
		return new Uint8Array(await readFile(localEventImagePath(key, dir))).buffer;
	} catch {
		return null;
	}
}

/**
 * The image when it is ready and `canSee` allows the event: a 302 to an inline signed
 * link, or the bytes from the local directory. 404 otherwise, the same as an unknown event.
 */
export async function eventImageResponse(
	eventId: string,
	canSee: (eventId: string) => Promise<boolean>,
	deps: EventImageServeDeps = defaultDeps(),
): Promise<Response> {
	// Access first: the key is not read for a viewer who may not see the event.
	if (!(await canSee(eventId))) {
		return NOT_FOUND();
	}
	const key = await deps.getKey(eventId);
	if (!key) {
		return NOT_FOUND();
	}
	if (deps.config) {
		const url = await deps.presign(deps.config, key, "image", { inline: true });
		return new Response(null, {
			status: 302,
			headers: { ...HEADERS, location: url },
		});
	}
	const bytes = deps.dir ? await readLocalImage(key, deps.dir) : null;
	if (!bytes) {
		return NOT_FOUND();
	}
	return new Response(bytes, {
		headers: {
			...HEADERS,
			"content-type": sniffImageType(bytes) ?? "application/octet-stream",
		},
	});
}

/** On the public site, under the event page's rules (`invite` for invite-only events). */
export async function publicEventImageResponse(
	eventId: string,
	invite: string | undefined,
): Promise<Response> {
	return eventImageResponse(eventId, await visitorCanSee(invite));
}

/** In the panel, for the event's managers (drafts included). */
export async function panelEventImageResponse(
	eventId: string,
): Promise<Response> {
	return eventImageResponse(eventId, await managerCanSee());
}
