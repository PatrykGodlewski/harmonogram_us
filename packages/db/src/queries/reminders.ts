import { and, asc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { eventRegistrations } from "../schema/event-registrations";
import { events } from "../schema/events";

/**
 * Finds published events whose reminder is due at `now` and hands each one's
 * registered people (not the waitlist) to `onRecipients`, inside a transaction
 * that also marks the event as reminded, so two runs never remind twice.
 */
export async function queueDueReminders(
	now: Date,
	onRecipients: (
		tx: TransactionClient,
		registrationIds: string[],
		eventId: string,
	) => Promise<void>,
): Promise<{ events: number }> {
	const due = await db
		.select({ id: events.id })
		.from(events)
		.where(
			and(
				eq(events.status, "published"),
				isNotNull(events.reminderHoursBefore),
				isNull(events.reminderSentAt),
				gt(events.date, now),
				sql`${events.date} - make_interval(hours => ${events.reminderHoursBefore}) <= ${now.toISOString()}::timestamptz`,
			),
		);
	let reminded = 0;
	for (const { id } of due) {
		const sent = await db.transaction(async (tx) => {
			const [claimed] = await tx
				.update(events)
				.set({ reminderSentAt: now })
				.where(and(eq(events.id, id), isNull(events.reminderSentAt)))
				.returning({ id: events.id });
			if (!claimed) {
				return false;
			}
			const rows = await tx
				.select({ id: eventRegistrations.id })
				.from(eventRegistrations)
				.where(
					and(
						eq(eventRegistrations.eventId, id),
						eq(eventRegistrations.state, "registered"),
					),
				)
				.orderBy(asc(eventRegistrations.createdAt));
			if (rows.length > 0) {
				await onRecipients(
					tx,
					rows.map((row) => row.id),
					id,
				);
			}
			return true;
		});
		if (sent) reminded++;
	}
	return { events: reminded };
}
