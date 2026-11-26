import { timingSafeEqual } from "node:crypto";
import { canManageEvent } from "@repo/db/queries/event-organizers";
import { type EventAccess, getEventAccess } from "@repo/db/queries/events";
import { getUserRole } from "@repo/db/queries/roles";

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/** The invite-only rule of `canOpenEvent`, on access data already read. */
async function mayOpen(
	access: EventAccess,
	eventId: string,
	userId: string | null,
	invite: string | undefined,
): Promise<boolean> {
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
	return access ? mayOpen(access, eventId, userId, invite) : false;
}

export type EventViewAccess = "allowed" | "sign-in" | "hidden";

/**
 * Whether the viewer may open the event page (and so its files): not a draft,
 * signed in for a signed-in-only event, and allowed by `canOpenEvent`.
 * `"sign-in"` only for a published signed-in-only event and no viewer: signing
 * in would open it. Everything else that is closed is `"hidden"`, so nobody
 * learns that a draft or an invite-only event exists.
 */
export async function eventViewAccess(
	eventId: string,
	userId: string | null,
	invite: string | undefined,
): Promise<EventViewAccess> {
	const access = await getEventAccess(eventId, userId ?? undefined);
	if (!access || access.status === "draft") {
		return "hidden";
	}
	if (access.visibility === "authenticated" && !userId) {
		return access.status === "published" ? "sign-in" : "hidden";
	}
	return (await mayOpen(access, eventId, userId, invite))
		? "allowed"
		: "hidden";
}

/** `eventViewAccess` as a yes/no: images and other callers answer 404 for both closed cases. */
export async function canViewEvent(
	eventId: string,
	userId: string | null,
	invite: string | undefined,
): Promise<boolean> {
	return (await eventViewAccess(eventId, userId, invite)) === "allowed";
}
