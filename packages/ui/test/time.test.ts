import { describe, expect, it } from "vitest";
import {
	formatEventDateTime,
	eventDateStamp,
	formatEventDay,
	formatEventDayLong,
	formatEventTime,
	fromEventWallTime,
	fromEventWallTimeRange,
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

	it("a range ending before it starts ends the next day", () => {
		const night = fromEventWallTimeRange("2026-12-31", "23:00", "01:30");
		expect(night.startsAt.toISOString()).toBe("2026-12-31T22:00:00.000Z");
		expect(night.endsAt.toISOString()).toBe("2027-01-01T00:30:00.000Z");
		const day = fromEventWallTimeRange("2026-07-15", "10:00", "11:00");
		expect(day.endsAt.toISOString()).toBe("2026-07-15T09:00:00.000Z");
		// The same start and end stays empty, for the form to reject.
		const same = fromEventWallTimeRange("2026-07-15", "10:00", "10:00");
		expect(same.endsAt).toEqual(same.startsAt);
	});

	it("formatEventTime is zone-fixed", () => {
		expect(formatEventTime("2026-01-15T09:00:00Z", "pl")).toBe("10:00");
		expect(formatEventTime("2026-07-15T09:00:00Z", "en")).toBe("11:00");
	});

	it("formatEventDateTime joins date and time in Warsaw", () => {
		expect(formatEventDateTime("2026-01-15T09:00:00Z", "en")).toBe("Jan 15, 2026, 10:00");
	});
});

describe("programme days", () => {
	it("names a day short for chips and long for headings, in the event time zone", () => {
		// 23:30 UTC on the 11th is already the 12th in Warsaw
		const late = new Date("2026-12-11T23:30:00Z");
		expect(formatEventDay(late, "pl")).toBe("sob., 12.12");
		expect(formatEventDayLong(late, "pl")).toBe("sobota, 12 grudnia");
		expect(formatEventDay(late, "en")).toBe("Sat, 12/12");
		expect(formatEventDayLong(late, "en")).toBe("Saturday, December 12");
	});

	it("stamps a date as a day number and short month in Warsaw", () => {
		const late = new Date("2026-12-11T23:30:00Z");
		expect(eventDateStamp(late, "pl")).toEqual({ day: "12", month: "gru" });
		expect(eventDateStamp(late, "en")).toEqual({ day: "12", month: "Dec" });
	});
});

