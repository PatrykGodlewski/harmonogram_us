import { type SQL, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { effectiveEventEndSql } from "./event-registrations";

/**
 * A certificate exists for a registration that held a place, was checked in,
 * at a published event with certificates switched on that has ended.
 * `registration` and `event` are the SQL aliases of the two rows.
 */
export function certificateAvailableSql(
	registration: SQL,
	event: SQL,
	at: SQL = sql`now()`,
): SQL<boolean> {
	return sql<boolean>`(${registration}.state = 'registered'
		AND ${registration}.checked_in_at IS NOT NULL
		AND ${event}.certificates_enabled
		AND ${event}.status = 'published'
		AND ${effectiveEventEndSql(event)} <= ${at})`;
}

export type Certificate = {
	name: string;
	eventTitle: string;
	eventDate: Date;
	locale: "pl" | "en";
};

/** The certificate of the user's own registration; null when there is none to give. */
export async function getCertificate(
	registrationId: string,
	userId: string,
): Promise<Certificate | null> {
	const [row] = await db.execute<{
		name: string;
		title: string;
		date: string;
		locale: "pl" | "en";
	}>(sql`
		SELECT u.name, e.title, e.date, r.locale
		FROM event_registrations r
		JOIN events e ON e.id = r.event_id
		JOIN "user" u ON u.id = r.user_id
		WHERE r.id = ${registrationId} AND r.user_id = ${userId}
			AND ${certificateAvailableSql(sql`r`, sql`e`)}
	`);
	return row
		? {
				name: row.name,
				eventTitle: row.title,
				eventDate: new Date(row.date),
				locale: row.locale,
			}
		: null;
}

/** Attendees per run; the next run (15 minutes later) takes the rest. */
const CLAIM_BATCH = 500;
/** Events that ended longer ago than this send no "certificate ready" e-mail (switched on late). */
const SEND_WINDOW_DAYS = 30;

/**
 * Claims every attendee whose certificate became available by `now` and who
 * has not been e-mailed yet (one statement, `SKIP LOCKED`, so two workers never
 * claim the same person; people checked in late are picked up on a later run)
 * and hands them to `onRecipients`, in the same transaction.
 */
export async function queueReadyCertificates(
	now: Date,
	onRecipients: (
		tx: TransactionClient,
		registrationIds: string[],
	) => Promise<void>,
): Promise<{ registrations: number }> {
	const at = now.toISOString();
	return db.transaction(async (tx) => {
		const claimed = await tx.execute<{ id: string }>(sql`
			UPDATE event_registrations SET certificate_emailed_at = ${at}::timestamptz
			WHERE id IN (
				SELECT r.id FROM event_registrations r
				JOIN events e ON e.id = r.event_id
				WHERE r.certificate_emailed_at IS NULL
					AND ${certificateAvailableSql(sql`r`, sql`e`, sql`${at}::timestamptz`)}
					AND ${effectiveEventEndSql(sql`e`)} > ${at}::timestamptz - make_interval(days => ${SEND_WINDOW_DAYS})
				ORDER BY r.created_at
				LIMIT ${CLAIM_BATCH}
				FOR UPDATE OF r SKIP LOCKED
			)
			RETURNING id`);
		if (claimed.length > 0) {
			await onRecipients(
				tx,
				claimed.map((row) => row.id),
			);
		}
		return { registrations: claimed.length };
	});
}
