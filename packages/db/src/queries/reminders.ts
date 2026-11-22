import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { eventRegistrations } from "../schema/event-registrations";

/**
 * Claims every published event whose reminder is due at `now` (one statement
 * that re-checks the whole condition, so a date moved meanwhile isn't claimed
 * and two workers never claim the same event) and hands each one's registered
 * people (not the waitlist) to `onRecipients`, in the same transaction.
 */
export async function queueDueReminders(
	now: Date,
	onRecipients: (
		tx: TransactionClient,
		registrationIds: string[],
		eventId: string,
	) => Promise<void>,
): Promise<{ events: number }> {
	const at = now.toISOString();
	return db.transaction(async (tx) => {
		const claimed = await tx.execute<{ id: string }>(sql`
			UPDATE events SET reminder_sent_at = ${at}::timestamptz
			WHERE id IN (
				SELECT id FROM events
				WHERE status = 'published'
					AND reminder_hours_before IS NOT NULL
					AND reminder_sent_at IS NULL
					AND date > ${at}::timestamptz
					AND date - make_interval(hours => reminder_hours_before) <= ${at}::timestamptz
				FOR UPDATE SKIP LOCKED
			)
			RETURNING id`);
		if (claimed.length === 0) {
			return { events: 0 };
		}
		const rows = await tx
			.select({
				id: eventRegistrations.id,
				eventId: eventRegistrations.eventId,
			})
			.from(eventRegistrations)
			.where(
				and(
					inArray(
						eventRegistrations.eventId,
						claimed.map((row) => row.id),
					),
					eq(eventRegistrations.state, "registered"),
				),
			)
			.orderBy(asc(eventRegistrations.createdAt));
		for (const { id } of claimed) {
			const ids = rows.filter((row) => row.eventId === id).map((row) => row.id);
			if (ids.length > 0) {
				await onRecipients(tx, ids, id);
			}
		}
		return { events: claimed.length };
	});
}
