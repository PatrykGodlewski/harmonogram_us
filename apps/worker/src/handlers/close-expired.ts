import { closeExpiredGroups } from "@repo/db/queries/groups";

/** Releases holds of groups past their confirmation deadline. */
export function closeExpired(now: Date = new Date()): Promise<number> {
	return closeExpiredGroups(now);
}
