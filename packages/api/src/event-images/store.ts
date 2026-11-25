/** Server-only: where cover images live — the S3 bucket, or a local directory without one. */
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "@repo/env";
import { putObject, type StorageConfig, storageConfig } from "../storage/s3";
import type { GeneratedImage } from "./providers";

export type StoreImageDeps = {
	config: StorageConfig | null;
	put: typeof putObject;
	/** Used when `config` is null. */
	dir: string;
};

/** The local image directory (env `EVENT_IMAGE_DIR`, relative to the working directory). */
export function eventImageDir(): string {
	return resolve(env.EVENT_IMAGE_DIR ?? "data/event-images");
}

const defaultDeps = (): StoreImageDeps => ({
	config: storageConfig(),
	put: putObject,
	dir: eventImageDir(),
});

/** Saves the bytes under a new key and returns it. */
export async function storeEventImage(
	eventId: string,
	image: GeneratedImage,
	deps: StoreImageDeps = defaultDeps(),
): Promise<string> {
	const key = `event-images/${eventId}/${randomUUID()}`;
	if (deps.config) {
		await deps.put(deps.config, key, image.bytes, image.mimeType);
		return key;
	}
	// Keys are app-made (never user input), so they are safe as relative paths.
	const path = join(deps.dir, key);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, new Uint8Array(image.bytes));
	return key;
}

/** Deletes a key from the local directory (no bucket); a missing file counts as deleted. */
export async function removeLocalEventImage(
	key: string,
	dir: string = eventImageDir(),
): Promise<void> {
	const root = resolve(dir);
	const path = resolve(root, key);
	// Deletion keys come from a table shared with other files: never leave the directory.
	if (!path.startsWith(`${root}${sep}`)) {
		throw new Error("Stored file key is outside the image directory");
	}
	await rm(path, { force: true });
}
