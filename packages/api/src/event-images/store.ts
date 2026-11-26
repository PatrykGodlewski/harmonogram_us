/** Server-only: where cover images live — the S3 bucket, or else a local directory. */
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "@repo/env";
import { putObject, type StorageConfig, storageConfig } from "../storage/s3";
import type { GeneratedImage } from "./providers";

export type StoreImageDeps = {
	config: StorageConfig | null;
	put: typeof putObject;
	/** Used when `config` is null; null when no directory is set either. */
	dir: string | null;
};

/**
 * The local image directory: env `EVENT_IMAGE_DIR`, an absolute path (every app runs in
 * its own working directory). Null when unset: there is no default.
 */
export function eventImageDir(): string | null {
	return env.EVENT_IMAGE_DIR ?? null;
}

/** A bucket or a local directory is set; without either cover images are off. */
export function imageStorageConfigured(): boolean {
	return storageConfig() !== null || eventImageDir() !== null;
}

const NO_STORAGE =
	"No storage for cover images (no S3 bucket, no EVENT_IMAGE_DIR)";

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
	if (!deps.dir) {
		throw new Error(NO_STORAGE);
	}
	// Keys are app-made (never user input), so they are safe as relative paths.
	const path = join(deps.dir, key);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, new Uint8Array(image.bytes));
	return key;
}

/** The key's file in the local directory; throws for a key that would leave it. */
export function localEventImagePath(key: string, dir: string): string {
	const root = resolve(dir);
	const path = resolve(root, key);
	if (!path.startsWith(`${root}${sep}`)) {
		throw new Error("Stored file key is outside the image directory");
	}
	return path;
}

/**
 * Deletes a key from the local directory (no bucket). Throws when the file is missing:
 * the key may name an object in a bucket, whose deletion record must stay.
 */
export async function removeLocalEventImage(
	key: string,
	dir: string | null = eventImageDir(),
): Promise<void> {
	if (!dir) {
		throw new Error(NO_STORAGE);
	}
	// Deletion keys come from a table shared with other files: never leave the directory.
	await rm(localEventImagePath(key, dir));
}
