import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("configured time zone", () => {
	it("formatEventDateTime uses the configured zone", async () => {
		vi.stubEnv("VITE_APP_TIME_ZONE", "Europe/London");
		const { formatEventDateTime } = await import("../src/time");
		expect(formatEventDateTime("2026-06-01T12:00:00Z", "en-GB")).toContain("13:00");
	});

	it("fromEventWallTime reads wall time in the configured zone", async () => {
		vi.stubEnv("VITE_APP_TIME_ZONE", "Europe/London");
		const { fromEventWallTime } = await import("../src/time");
		expect(fromEventWallTime("2026-01-15", "10:00").toISOString()).toBe(
			"2026-01-15T10:00:00.000Z",
		);
	});
});
