import { describe, expect, it } from "vitest";
import { EMAIL_WORK } from "../src/work-options";

describe("e-mail work options", () => {
	it("fetches one job at a time so a failure never retries e-mails already sent", () => {
		// pg-boss fails (and retries) the whole fetched batch when the handler throws.
		expect(EMAIL_WORK.batchSize).toBe(1);
		expect(EMAIL_WORK.localConcurrency).toBeGreaterThan(1);
	});
});

describe("e-mail throughput under a backlog", () => {
	it("drains a backlog without waiting between fetches and polls often when idle", () => {
		// Load test: 500 registrations queued 500 e-mails, sent at 2.5/s with the default
		// 2 s poll (5 handlers × 1 job / 2 s). Burst mode fetches continuously instead.
		expect(EMAIL_WORK.burstWhenReadyExceeds).toBeGreaterThanOrEqual(1);
		expect(EMAIL_WORK.pollingIntervalSeconds).toBeLessThanOrEqual(1);
	});
});
