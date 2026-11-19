import { describe, expect, it } from "vitest";
import {
	formatEventDateTime,
	formatEventTime,
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "../src/time";

describe("Warsaw time", () => {
	it("warsaw wall time across DST", () => {
		expect(fromEventWallTime("2026-03-29", "10:00").toISOString()).toBe(
			"2026-03-29T08:00:00.000Z",
		);
		expect(fromEventWallTime("2026-01-15", "10:00").toISOString()).toBe(
			"2026-01-15T09:00:00.000Z",
		);
		for (const [date, time] of [
			["2026-03-29", "10:00"],
			["2026-01-15", "10:00"],
			["2026-10-25", "23:30"],
		] as const) {
			const value = fromEventWallTime(date, time);
			expect(toEventTimeInput(value)).toBe(time);
			expect(toEventDateInput(value)).toBe(date);
		}
	});

	it("formatEventTime is zone-fixed", () => {
		expect(formatEventTime("2026-01-15T09:00:00Z", "pl")).toBe("10:00");
		expect(formatEventTime("2026-07-15T09:00:00Z", "en")).toBe("11:00");
	});

	it("formatEventDateTime joins date and time in Warsaw", () => {
		expect(formatEventDateTime("2026-01-15T09:00:00Z", "en")).toBe("Jan 15, 2026, 10:00");
	});
});

