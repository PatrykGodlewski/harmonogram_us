import { type SQL, sql } from "drizzle-orm";
import { db } from "../client";
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
