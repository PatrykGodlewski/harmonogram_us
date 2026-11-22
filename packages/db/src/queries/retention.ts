import { sql } from "drizzle-orm";
import { db } from "../client";
import { effectiveEventEndSql } from "./event-registrations";

/**
 * Deletes personal data of events that ended more than `retentionDays` ago:
 * their registrations (agenda-item registrations cascade) and their groups
 * (members hold e-mail addresses). The events themselves stay.
 */
export async function pruneOldRegistrations(
	now: Date,
	retentionDays: number,
): Promise<{ deleted: number }> {
	const cutoff = new Date(now.getTime() - retentionDays * 86_400_000);
	const expired = sql`SELECT e.id FROM events e WHERE ${effectiveEventEndSql(sql`e`)} < ${cutoff.toISOString()}::timestamptz`;
	return db.transaction(async (tx) => {
		const deleted = await tx.execute<{ id: string }>(
			sql`DELETE FROM event_registrations WHERE event_id IN (${expired}) RETURNING id`,
		);
		await tx.execute(
			sql`DELETE FROM registration_groups WHERE event_id IN (${expired})`,
		);
		return { deleted: deleted.length };
	});
}
