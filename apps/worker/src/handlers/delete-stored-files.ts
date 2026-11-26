import { removeLocalEventImage } from "@repo/api/event-images/store";
import { deleteObject, storageConfig } from "@repo/api/storage/s3";
import {
	forgetStoredFileDeletions,
	STORED_FILE_GRACE_MS,
	takeStoredFileDeletions,
} from "@repo/db/queries/event-files";

/** Keys per run; the next run (15 minutes later) takes the rest. */
const BATCH = 500;
/** Requests to the bucket at a time. */
const PARALLEL = 20;

export type DeleteStoredFilesDeps = {
	config: ReturnType<typeof storageConfig>;
	take: typeof takeStoredFileDeletions;
	remove: typeof deleteObject;
	/**
	 * Without a bucket only cover images are stored, in a local directory. Rejects
	 * unless the file existed and was removed, so other keys stay queued.
	 */
	removeLocal: (key: string) => Promise<void>;
	forget: typeof forgetStoredFileDeletions;
};

const defaultDeps = (): DeleteStoredFilesDeps => ({
	config: storageConfig(),
	take: takeStoredFileDeletions,
	remove: deleteObject,
	removeLocal: (key) => removeLocalEventImage(key),
	forget: forgetStoredFileDeletions,
});

/**
 * Deletes the objects of removed files; a failed delete stays queued for the next run.
 * Keys younger than the grace period are left alone: they may be uploads in progress.
 */
export async function deleteStoredFiles(
	deps: DeleteStoredFilesDeps = defaultDeps(),
): Promise<{ deleted: number; failed: number }> {
	const { config } = deps;
	const remove = config
		? (key: string) => deps.remove(config, key)
		: deps.removeLocal;
	const keys = await deps.take(
		BATCH,
		new Date(Date.now() - STORED_FILE_GRACE_MS),
	);
	const deleted: string[] = [];
	for (let start = 0; start < keys.length; start += PARALLEL) {
		const chunk = keys.slice(start, start + PARALLEL);
		const results = await Promise.allSettled(chunk.map(remove));
		deleted.push(
			...chunk.filter((_, index) => results[index]?.status === "fulfilled"),
		);
	}
	await deps.forget(deleted);
	return { deleted: deleted.length, failed: keys.length - deleted.length };
}
