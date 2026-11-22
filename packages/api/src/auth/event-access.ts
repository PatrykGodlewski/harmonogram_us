import { getAgendaItemEventId } from "@repo/db/queries/agenda-items";
import { getAgendaSessionEventId } from "@repo/db/queries/agenda-sessions";
import {
	canCheckIn,
	canCreateEvents,
	canManageEvent,
} from "@repo/db/queries/event-organizers";
import { getQuestionEventId } from "@repo/db/queries/event-questions";
import { getEventStatus } from "@repo/db/queries/events";
import { appError } from "../errors";
import type { AuthenticatedUser } from "./user";

/** Throws FORBIDDEN unless the user is an admin or an organizer of the event. */
export async function assertCanManageEvent(
	user: AuthenticatedUser,
	eventId: string,
): Promise<void> {
	if (!(await canManageEvent(user, eventId))) {
		throw appError("FORBIDDEN");
	}
}

/** Throws FORBIDDEN unless the user may scan tickets and mark attendance (managers and helpers). */
export async function assertCanCheckIn(
	user: AuthenticatedUser,
	eventId: string,
): Promise<void> {
	if (!(await canCheckIn(user, eventId))) {
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

/** Like `assertCanManageEvent`, for the event a session belongs to (NOT_FOUND if none). */
export async function assertCanManageAgendaSession(
	user: AuthenticatedUser,
	sessionId: string,
): Promise<void> {
	const eventId = await getAgendaSessionEventId(sessionId);
	if (!eventId) {
		throw appError("NOT_FOUND");
	}
	await assertCanManageEvent(user, eventId);
}

/** Throws FORBIDDEN unless the user may create events (organizer or admin). */
export async function assertCanCreateEvents(
	user: AuthenticatedUser,
): Promise<void> {
	if (!canCreateEvents(user.role)) {
		throw appError("FORBIDDEN");
	}
}

/**
 * Admins delete any event; organizers only drafts. A published event goes
 * through cancellation, so registrants are told and its history stays.
 */
export async function assertCanDeleteEvent(
	user: AuthenticatedUser,
	eventId: string,
): Promise<void> {
	await assertCanManageEvent(user, eventId);
	if (user.isAdmin) {
		return;
	}
	if ((await getEventStatus(eventId)) !== "draft") {
		throw appError("FORBIDDEN");
	}
}

/** NOT_FOUND for an unknown question; FORBIDDEN unless the user manages its event. */
export async function assertCanManageQuestion(
	user: AuthenticatedUser,
	questionId: string,
): Promise<void> {
	const eventId = await getQuestionEventId(questionId);
	if (!eventId) {
		throw appError("NOT_FOUND");
	}
	await assertCanManageEvent(user, eventId);
}
