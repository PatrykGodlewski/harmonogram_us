import { env } from "@repo/env";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";

let client: Redis | null | undefined;

function redis(): Redis | null {
	if (client === undefined) {
		client = env.REDIS_URL
			? new Redis(env.REDIS_URL, {
					password: env.REDIS_PASSWORD || undefined,
					lazyConnect: true,
					maxRetriesPerRequest: 1,
				})
			: null;
	}
	return client;
}

/** Redis-backed limiter; a no-op when Redis isn't configured (dev without Redis, tests). */
export function createRateLimiter(
	keyPrefix: string,
	points: number,
	durationSeconds: number,
) {
	let limiter: RateLimiterRedis | null | undefined;
	return async function consume(key: string): Promise<void> {
		if (limiter === undefined) {
			const store = redis();
			limiter = store
				? new RateLimiterRedis({
						storeClient: store,
						keyPrefix,
						points,
						duration: durationSeconds,
					})
				: null;
		}
		if (!limiter) {
			return;
		}
		try {
			await limiter.consume(key);
		} catch {
			throw new Error("RATE_LIMITED");
		}
	};
}
