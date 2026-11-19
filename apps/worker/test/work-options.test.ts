import { describe, expect, it } from "vitest";
import { EMAIL_WORK } from "../src/work-options";

describe("e-mail work options", () => {
	it("fetches one job at a time so a failure never retries e-mails already sent", () => {
		// pg-boss fails (and retries) the whole fetched batch when the handler throws.
		expect(EMAIL_WORK.batchSize).toBe(1);
		expect(EMAIL_WORK.localConcurrency).toBeGreaterThan(1);
	});
});
