import { SURVEY_OPEN_DAYS } from "@repo/db/queries/surveys";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadEnv() {
	vi.resetModules();
	return (await import("@repo/env")).env;
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("REGISTRATION_RETENTION_DAYS", () => {
	it("is at least the survey window, which is 30 days", async () => {
		// The env schema cannot import @repo/db, so it repeats the number.
		expect(SURVEY_OPEN_DAYS).toBe(30);

		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubEnv("REGISTRATION_RETENTION_DAYS", String(SURVEY_OPEN_DAYS - 1));
		await expect(loadEnv()).rejects.toThrow();
		expect(JSON.stringify(error.mock.calls)).toContain(
			"REGISTRATION_RETENTION_DAYS",
		);
		error.mockRestore();

		vi.stubEnv("REGISTRATION_RETENTION_DAYS", String(SURVEY_OPEN_DAYS));
		expect((await loadEnv()).REGISTRATION_RETENTION_DAYS).toBe(
			SURVEY_OPEN_DAYS,
		);
	});
});
