/** Server-only: the guest form of an event (F17); used by `fetchGuestFormServer`. */
import { db } from "@repo/db/client";
import { listEventQuestions } from "@repo/db/queries/event-questions";
import { hasEventEnded } from "@repo/db/queries/event-registrations";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { appError } from "../errors";
import { canOpenEvent } from "./access";
import type { GuestForm } from "./guest-form";

/**
 * The event's title and registration questions for the sign-in page: published events
 * that still take registrations (not cancelled or ended), signed-in-only ones included
 * (the e-mail link signs the guest in); invite-only events need their current link.
 * Otherwise EVENT_NOT_FOUND, like an unknown event.
 */
export async function loadGuestForm(
	eventId: string,
	invite: string | undefined,
): Promise<GuestForm> {
	if (!(await canOpenEvent(eventId, null, invite))) {
		throw appError("EVENT_NOT_FOUND");
	}
	const [event] = await db
		.select({ title: events.title, status: events.status })
		.from(events)
		.where(eq(events.id, eventId));
	if (event?.status !== "published" || (await hasEventEnded(db, eventId))) {
		throw appError("EVENT_NOT_FOUND");
	}
	const questions = await listEventQuestions(eventId, "registration");
	return {
		eventId,
		title: event.title,
		questions: questions.map(({ id, label, kind, options, required }) => ({
			id,
			label,
			kind,
			options,
			required,
		})),
	};
}
