import { registrationEmailHooks } from "@repo/api/notifications/registration-hooks";
import { closeExpiredGroups } from "@repo/db/queries/groups";

/** Releases holds of groups past their confirmation deadline; promoted people get e-mails. */
export function closeExpired(now: Date = new Date()): Promise<number> {
	return closeExpiredGroups(now, registrationEmailHooks);
}
