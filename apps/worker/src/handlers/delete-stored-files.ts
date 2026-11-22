import { deleteObject, storageConfig } from "@repo/api/storage/s3";
import {
	forgetStoredFileDeletions,
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
	forget: typeof forgetStoredFileDeletions;
};

const defaultDeps = (): DeleteStoredFilesDeps => ({
	config: storageConfig(),
	take: takeStoredFileDeletions,
	remove: deleteObject,
	forget: forgetStoredFileDeletions,
});

/** Deletes the objects of removed files; a failed delete stays queued for the next run. */
export async function deleteStoredFiles(
	deps: DeleteStoredFilesDeps = defaultDeps(),
): Promise<{ deleted: number; failed: number }> {
	const { config } = deps;
	if (!config) {
		return { deleted: 0, failed: 0 };
	}
	const keys = await deps.take(BATCH);
	const deleted: string[] = [];
	for (let start = 0; start < keys.length; start += PARALLEL) {
		const chunk = keys.slice(start, start + PARALLEL);
		const results = await Promise.allSettled(
			chunk.map((key) => deps.remove(config, key)),
		);
		deleted.push(
			...chunk.filter((_, index) => results[index]?.status === "fulfilled"),
		);
	}
	await deps.forget(deleted);
	return { deleted: deleted.length, failed: keys.length - deleted.length };
}
