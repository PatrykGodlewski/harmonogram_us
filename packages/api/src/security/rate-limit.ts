import { hitRateLimit } from "@repo/db/queries/rate-limits";
import { appError } from "../errors";

/** Points per window; optionally block the key for a while once exhausted. */
export type RateLimit = {
	points: number;
	durationSeconds: number;
	blockDurationSeconds?: number;
};

/**
 * Consumes one point for `key` under `keyPrefix`; throws `RATE_LIMITED` when exhausted.
 * Counters live in Postgres (`app_rate_limits`); database errors propagate.
 * Call it only inside server handlers, never at module level.
 */
export async function consumeRateLimit(
	keyPrefix: string,
	limit: RateLimit,
	key: string,
): Promise<void> {
	if (!(await hitRateLimit(`${keyPrefix}:${key}`, limit))) {
		throw appError("RATE_LIMITED");
	}
}
