import { sql } from "drizzle-orm";
import { db } from "../client";

export type RateLimitRule = {
	points: number;
	durationSeconds: number;
	blockDurationSeconds?: number;
};

/**
 * Records one hit for `key`; returns false when the key is over its limit or blocked.
 * One atomic upsert: a hit after the window resets it; exhausting the points starts the block.
 */
export async function hitRateLimit(
	key: string,
	limit: RateLimitRule,
): Promise<boolean> {
	const block = limit.blockDurationSeconds ?? 0;
	const rows = await db.execute<{ allowed: boolean }>(sql`
		INSERT INTO app_rate_limits AS r (key, window_start, points, blocked_until)
		VALUES (${key}, now(), 1, NULL)
		ON CONFLICT (key) DO UPDATE SET
			window_start = CASE
				WHEN r.window_start <= now() - make_interval(secs => ${limit.durationSeconds}) THEN now()
				ELSE r.window_start END,
			points = CASE
				WHEN r.window_start <= now() - make_interval(secs => ${limit.durationSeconds}) THEN 1
				ELSE r.points + 1 END,
			blocked_until = CASE
				WHEN r.blocked_until > now() THEN r.blocked_until
				WHEN r.window_start > now() - make_interval(secs => ${limit.durationSeconds})
					AND r.points + 1 > ${limit.points} AND ${block} > 0
					THEN now() + make_interval(secs => ${block})
				ELSE NULL END
		RETURNING (points <= ${limit.points} AND (blocked_until IS NULL OR blocked_until <= now())) AS allowed
	`);
	return rows[0]?.allowed ?? false;
}

/**
 * Deletes counters whose window started more than a day ago and that are not blocked.
 * Keys contain e-mail addresses and IPs, so they are kept only as long as limits need them.
 */
export async function pruneRateLimits(): Promise<number> {
	const rows = await db.execute<{ key: string }>(sql`
		DELETE FROM app_rate_limits
		WHERE window_start < now() - interval '1 day'
			AND (blocked_until IS NULL OR blocked_until <= now())
		RETURNING key
	`);
	return rows.length;
}
