import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { hitRateLimit } from "../src/queries/rate-limits";

beforeEach(async () => {
	await db.execute(sql`TRUNCATE app_rate_limits`);
});

async function shiftWindow(key: string, seconds: number) {
	await db.execute(sql`
		UPDATE app_rate_limits
		SET window_start = window_start - make_interval(secs => ${seconds})
		WHERE key = ${key}
	`);
}

describe("hitRateLimit", () => {
	it("allows points then refuses", async () => {
		const limit = { points: 2, durationSeconds: 60 };
		expect(await hitRateLimit("a", limit)).toBe(true);
		expect(await hitRateLimit("a", limit)).toBe(true);
		expect(await hitRateLimit("a", limit)).toBe(false);
		expect(await hitRateLimit("b", limit)).toBe(true);
	});

	it("window resets", async () => {
		const limit = { points: 1, durationSeconds: 60 };
		expect(await hitRateLimit("a", limit)).toBe(true);
		expect(await hitRateLimit("a", limit)).toBe(false);
		await shiftWindow("a", 61);
		expect(await hitRateLimit("a", limit)).toBe(true);
	});

	it("block holds after exhaustion", async () => {
		const limit = { points: 1, durationSeconds: 10, blockDurationSeconds: 600 };
		expect(await hitRateLimit("a", limit)).toBe(true);
		expect(await hitRateLimit("a", limit)).toBe(false);
		await shiftWindow("a", 11);
		expect(await hitRateLimit("a", limit)).toBe(false);
	});
});
