import { describe, expect, it } from "vitest";
import { findOverlaps, markParallel } from "../src/agenda";

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
