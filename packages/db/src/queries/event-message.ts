import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { eventRegistrations } from "../schema/event-registrations";

/** Who an organizer's message goes to: a group, or exactly the people selected on the list. */
export type MessageAudience = "registered" | "waitlisted" | "all";
export type MessageTarget = MessageAudience | { registrationIds: string[] };

/**
 * Picks the event's registrations for a message and hands them to
 * `onRecipients` inside one transaction (the caller queues the e-mails there).
 */
export async function messageRegistrants(
	eventId: string,
	target: MessageTarget,
	onRecipients: (
		tx: TransactionClient,
		registrationIds: string[],
	) => Promise<void>,
): Promise<{ recipients: number }> {
	return db.transaction(async (tx) => {
		const rows = await tx
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.eventId, eventId),
					typeof target === "object"
						? inArray(eventRegistrations.id, target.registrationIds)
						: target === "all"
							? inArray(eventRegistrations.state, ["registered", "waitlisted"])
							: eq(eventRegistrations.state, target),
				),
			)
			.orderBy(asc(eventRegistrations.createdAt));
		const ids = rows.map((row) => row.id);
		if (ids.length > 0) {
			await onRecipients(tx, ids);
		}
		return { recipients: ids.length };
	});
}
