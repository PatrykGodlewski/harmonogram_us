import { sql } from "drizzle-orm";
import { db } from "../client";

export type MonthlyActivity = {
	/** `YYYY-MM` in the given time zone. */
	month: string;
	/** Published or cancelled events taking place that month (drafts are not counted). */
	events: number;
	/** Registrations made that month, except rejected ones. */
	registrations: number;
};

/**
 * Events and registrations per month for the last `months` months including the current
 * one, oldest first, months without data as zeros (F15). Aggregated in SQL over a bounded
 * window, bucketed by local month in `timeZone`.
 */
export async function getMonthlyActivity(
	months: number,
	timeZone: string,
	now: Date = new Date(),
): Promise<MonthlyActivity[]> {
	const rows = await db.execute<{
		month: string;
		events: number;
		registrations: number;
	}>(sql`
		WITH bounds AS (
			SELECT
				date_trunc('month', ${now.toISOString()}::timestamptz AT TIME ZONE ${timeZone})
					- make_interval(months => ${months - 1}) AS first_month,
				date_trunc('month', ${now.toISOString()}::timestamptz AT TIME ZONE ${timeZone}) AS last_month
		),
		window_utc AS (
			SELECT
				first_month AT TIME ZONE ${timeZone} AS from_utc,
				(last_month + interval '1 month') AT TIME ZONE ${timeZone} AS to_utc
			FROM bounds
		),
		month_list AS (
			SELECT generate_series(first_month, last_month, interval '1 month') AS month
			FROM bounds
		),
		event_counts AS (
			SELECT date_trunc('month', e.date AT TIME ZONE ${timeZone}) AS month, count(*)::int AS n
			FROM events e, window_utc w
			WHERE e.status <> 'draft' AND e.date >= w.from_utc AND e.date < w.to_utc
			GROUP BY 1
		),
		registration_counts AS (
			SELECT date_trunc('month', r.created_at AT TIME ZONE ${timeZone}) AS month, count(*)::int AS n
			FROM event_registrations r, window_utc w
			WHERE r.state <> 'rejected' AND r.created_at >= w.from_utc AND r.created_at < w.to_utc
			GROUP BY 1
		)
		SELECT
			to_char(m.month, 'YYYY-MM') AS month,
			coalesce(e.n, 0) AS events,
			coalesce(r.n, 0) AS registrations
		FROM month_list m
		LEFT JOIN event_counts e ON e.month = m.month
		LEFT JOIN registration_counts r ON r.month = m.month
		ORDER BY m.month
	`);
	return rows.map((row) => ({
		month: row.month,
		events: Number(row.events),
		registrations: Number(row.registrations),
	}));
}
