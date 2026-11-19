import { describe, expect, it } from "vitest";
import { findOverlaps, layoutAgenda, markParallel } from "../src/agenda";

const at = (time: string) => `2026-03-14T${time}:00Z`;
const item = (id: string, start: string, end: string) => ({
	id,
	title: id,
	startsAt: at(start),
	endsAt: at(end),
});

describe("markParallel", () => {
	it("flags items starting while an earlier one runs", () => {
		const result = markParallel([
			item("lasers", "12:00", "13:30"),
			item("opening", "09:00", "10:00"),
			item("robotics", "12:30", "14:00"),
			item("coffee", "13:30", "14:00"),
		]);
		expect(result.map((r) => [r.id, r.parallel])).toEqual([
			["opening", false],
			["lasers", false],
			["robotics", true],
			["coffee", true],
		]);
	});

	it("touching items are not parallel", () => {
		const result = markParallel([
			item("a", "12:00", "13:30"),
			item("b", "13:30", "14:00"),
		]);
		expect(result.map((r) => r.parallel)).toEqual([false, false]);
	});
});

describe("findOverlaps", () => {
	const items = [
		item("Lasers", "12:00", "13:30"),
		item("Robotics", "12:30", "14:00"),
		item("Coffee", "13:30", "14:00"),
	];

	it("maps selected overlapping items to each other", () => {
		const result = findOverlaps(items, new Set(["Lasers", "Robotics"]));
		expect(result.get("Lasers")).toEqual(["Robotics"]);
		expect(result.get("Robotics")).toEqual(["Lasers"]);
	});

	it("ignores touching and unselected items", () => {
		expect(findOverlaps(items, new Set(["Lasers", "Coffee"])).size).toBe(0);
		expect(findOverlaps(items, new Set(["Lasers"])).size).toBe(0);
	});
});

describe("layoutAgenda", () => {
	const TZ = "Europe/Warsaw";
	// 2026-11-19 in Warsaw is UTC+1: 10:00 local = 09:00Z.
	const item = (id: string, start: string, end: string) => ({
		id,
		title: id,
		startsAt: new Date(start),
		endsAt: new Date(end),
	});

	it("puts parallel sessions in separate lanes", () => {
		const [day] = layoutAgenda(
			[
				item("opening", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("a", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("b", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
			],
			TZ,
		);
		expect(day?.lanes).toBe(2);
		expect(day?.items.map((i) => [i.id, i.lane])).toEqual([
			["opening", 0],
			["a", 0],
			["b", 1],
		]);
	});

	it("items outside a parallel block use the full width", () => {
		const [day] = layoutAgenda(
			[
				item("opening", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("a", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("b", "2026-11-19T10:30:00Z", "2026-11-19T12:00:00Z"),
				item("closing", "2026-11-19T12:00:00Z", "2026-11-19T12:30:00Z"),
			],
			TZ,
		);
		expect(day?.items.map((i) => [i.id, i.lanes])).toEqual([
			["opening", 1],
			["a", 2],
			["b", 2],
			["closing", 1],
		]);
	});

	it("an item that starts when the previous ends shares its lane", () => {
		const [day] = layoutAgenda(
			[
				item("first", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("next", "2026-11-19T10:00:00Z", "2026-11-19T11:00:00Z"),
			],
			TZ,
		);
		expect(day?.lanes).toBe(1);
		expect(day?.items.map((i) => i.lane)).toEqual([0, 0]);
	});

	it("groups by day in the given time zone, not UTC", () => {
		// 23:30 in Warsaw on the 19th is 22:30Z, still the 19th; 00:30 on the 20th is 23:30Z on the 19th.
		const days = layoutAgenda(
			[
				item("late", "2026-11-19T22:30:00Z", "2026-11-19T22:50:00Z"),
				item("after-midnight", "2026-11-19T23:30:00Z", "2026-11-20T00:00:00Z"),
			],
			TZ,
		);
		expect(days.map((d) => [d.day, d.items.map((i) => i.id)])).toEqual([
			["2026-11-19", ["late"]],
			["2026-11-20", ["after-midnight"]],
		]);
		expect(days[0]?.items[0]?.startMinute).toBe(23 * 60 + 30);
	});

	it("a two-day agenda gives two days", () => {
		const days = layoutAgenda(
			[
				item("d1", "2026-11-19T09:00:00Z", "2026-11-19T10:00:00Z"),
				item("d2", "2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z"),
			],
			TZ,
		);
		expect(days.map((d) => d.day)).toEqual(["2026-11-19", "2026-11-20"]);
	});

	it("the day spans whole hours around its items", () => {
		const [day] = layoutAgenda(
			[item("x", "2026-11-19T09:15:00Z", "2026-11-19T10:40:00Z")],
			TZ,
		);
		expect([day?.startMinute, day?.endMinute]).toEqual([10 * 60, 12 * 60]);
		expect([day?.items[0]?.startMinute, day?.items[0]?.endMinute]).toEqual([10 * 60 + 15, 11 * 60 + 40]);
	});
});
