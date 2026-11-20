import { and, asc, eq, inArray, isNotNull, type SQL, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { eventRegistrations } from "../schema/event-registrations";
import { effectiveEventEndSql } from "./event-registrations";

/**
 * A certificate exists for a registration that held a place, was checked in,
 * at a published event with certificates switched on that has ended.
 * `registration` and `event` are the SQL aliases of the two rows.
 */
export function certificateAvailableSql(
	registration: SQL,
	event: SQL,
): SQL<boolean> {
	return sql<boolean>`(${registration}.state = 'registered'
		AND ${registration}.checked_in_at IS NOT NULL
		AND ${event}.certificates_enabled
		AND ${event}.status = 'published'
		AND ${effectiveEventEndSql(event)} <= now())`;
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

/** Events that ended longer ago than this get no "certificate ready" e-mail (switched on late). */
const SEND_WINDOW_DAYS = 30;

/**
 * Claims every published event with certificates that has ended by `now` (one
 * statement, `SKIP LOCKED`, so two workers never claim the same event) and hands
 * each one's attendees to `onRecipients`, in the same transaction.
 */
export async function queueReadyCertificates(
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
			UPDATE events SET certificates_sent_at = ${at}::timestamptz
			WHERE id IN (
				SELECT e.id FROM events e
				WHERE e.status = 'published'
					AND e.certificates_enabled
					AND e.certificates_sent_at IS NULL
					AND ${effectiveEventEndSql(sql`e`)} <= ${at}::timestamptz
					AND ${effectiveEventEndSql(sql`e`)} > ${at}::timestamptz - make_interval(days => ${SEND_WINDOW_DAYS})
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
					isNotNull(eventRegistrations.checkedInAt),
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
