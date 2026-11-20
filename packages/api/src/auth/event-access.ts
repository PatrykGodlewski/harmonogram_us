import { getAgendaItemEventId } from "@repo/db/queries/agenda-items";
import {
	canCreateEvents,
	canManageEvent,
} from "@repo/db/queries/event-organizers";
import { appError } from "../errors";
import type { AuthenticatedUser } from "./user";

/** Throws FORBIDDEN unless the user is an admin or an organizer of the event. */
export async function assertCanManageEvent(
	user: AuthenticatedUser,
	eventId: string,
): Promise<void> {
	if (!(await canManageEvent(user.id, eventId))) {
		throw appError("FORBIDDEN");
	}
}

/** Like `assertCanManageEvent`, for the event an agenda item belongs to (NOT_FOUND if none). */
export async function assertCanManageAgendaItem(
	user: AuthenticatedUser,
	itemId: string,
): Promise<void> {
	const eventId = await getAgendaItemEventId(itemId);
	if (!eventId) {
		throw appError("NOT_FOUND");
	}
	await assertCanManageEvent(user, eventId);
}

/** Throws FORBIDDEN unless the user may create events (organizer or admin). */
export async function assertCanCreateEvents(
	user: AuthenticatedUser,
): Promise<void> {
	if (!(await canCreateEvents(user.id))) {
		throw appError("FORBIDDEN");
	}
}
