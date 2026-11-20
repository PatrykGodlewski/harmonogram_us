import { timingSafeEqual } from "node:crypto";
import { canManageEvent } from "@repo/db/queries/event-organizers";
import { getEventAccess } from "@repo/db/queries/events";
import { getUserRole } from "@repo/db/queries/roles";

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether the viewer may open an event that is invite-only: with its current
 * invite link, holding a registration, or as its organiser (admins too). Other
 * events are open here; their own rules (drafts, signed-in only) apply elsewhere.
 * False for an unknown event.
 */
export async function canOpenEvent(
	eventId: string,
	userId: string | null,
	invite: string | undefined,
): Promise<boolean> {
	const access = await getEventAccess(eventId, userId ?? undefined);
	if (!access) {
		return false;
	}
	if (access.visibility !== "private" || access.hasRegistration) {
		return true;
	}
	if (invite && access.inviteToken && sameSecret(invite, access.inviteToken)) {
		return true;
	}
	if (!userId) {
		return false;
	}
	const role = (await getUserRole(userId)) ?? "user";
	return canManageEvent({ id: userId, role }, eventId);
}
