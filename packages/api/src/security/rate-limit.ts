import { env } from "@repo/env";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { appError } from "../errors";

/** Points per window; optionally block the key for a while once exhausted. */
export type RateLimit = {
	points: number;
	durationSeconds: number;
	blockDurationSeconds?: number;
};

let client: Redis | null | undefined;
const limiters = new Map<string, RateLimiterRedis | null>();

function redis(): Redis | null {
	if (client === undefined) {
		client = env.REDIS_URL
			? new Redis(env.REDIS_URL, {
					password: env.REDIS_PASSWORD || undefined,
					lazyConnect: true,
					maxRetriesPerRequest: 3,
				})
			: null;
	}
	return client;
}

/**
 * Consumes one point for `key` under `keyPrefix`; throws `RATE_LIMITED` when exhausted.
 * A no-op without Redis (dev without Redis, tests). Call it only inside server
 * handlers, never at module level: server-function modules are also imported by
 * the client, and module-level calls would pull Redis into the browser bundle.
 */
export async function consumeRateLimit(
	keyPrefix: string,
	limit: RateLimit,
	key: string,
): Promise<void> {
	if (!limiters.has(keyPrefix)) {
		const store = redis();
		limiters.set(
			keyPrefix,
			store
				? new RateLimiterRedis({
						storeClient: store,
						keyPrefix,
						points: limit.points,
						duration: limit.durationSeconds,
						blockDuration: limit.blockDurationSeconds,
					})
				: null,
		);
	}
	const limiter = limiters.get(keyPrefix);
	if (!limiter) {
		return;
	}
	try {
		await limiter.consume(key);
	} catch {
		throw appError("RATE_LIMITED");
	}
}
