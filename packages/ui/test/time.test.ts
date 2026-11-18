import { describe, expect, it } from "vitest";
import {
	formatWarsawDateTime,
	formatWarsawTime,
	fromWarsawWallTime,
	toWarsawDateInput,
	toWarsawTimeInput,
} from "../src/time";

describe("Warsaw time", () => {
	it("warsaw wall time across DST", () => {
		expect(fromWarsawWallTime("2026-03-29", "10:00").toISOString()).toBe(
			"2026-03-29T08:00:00.000Z",
		);
		expect(fromWarsawWallTime("2026-01-15", "10:00").toISOString()).toBe(
			"2026-01-15T09:00:00.000Z",
		);
		for (const [date, time] of [
			["2026-03-29", "10:00"],
			["2026-01-15", "10:00"],
			["2026-10-25", "23:30"],
		] as const) {
			const value = fromWarsawWallTime(date, time);
			expect(toWarsawTimeInput(value)).toBe(time);
			expect(toWarsawDateInput(value)).toBe(date);
		}
	});

	it("formatWarsawTime is zone-fixed", () => {
		expect(formatWarsawTime("2026-01-15T09:00:00Z", "pl")).toBe("10:00");
		expect(formatWarsawTime("2026-07-15T09:00:00Z", "en")).toBe("11:00");
	});

	it("formatWarsawDateTime joins date and time in Warsaw", () => {
		expect(formatWarsawDateTime("2026-01-15T09:00:00Z", "en")).toBe("Jan 15, 2026, 10:00");
	});
});

