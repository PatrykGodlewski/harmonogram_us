import { describe, expect, it } from "vitest";
import { registrantStats } from "../src/registrant-stats";

const at = new Date("2026-12-01T10:00:00Z");

describe("registrantStats", () => {
	const registrants = [
		{ state: "registered", checkedInAt: at },
		{ state: "registered", checkedInAt: null },
		{ state: "waitlisted", checkedInAt: null },
		{ state: "pending", checkedInAt: null },
		{ state: "rejected", checkedInAt: null },
	] as const;

	it("counts by state", () => {
		expect(registrantStats([...registrants], false)).toMatchObject({
			registered: 2,
			present: 1,
			waitlisted: 1,
			pending: 1,
		});
	});

	it("counts no-shows only after the event ends", () => {
		expect(registrantStats([...registrants], false)).toMatchObject({
			absent: null,
			absentShare: null,
		});
		expect(registrantStats([...registrants], true)).toMatchObject({
			absent: 1,
			absentShare: 0.5,
		});
	});

	it("has no no-show share when nobody registered", () => {
		expect(registrantStats([], true)).toEqual({
			registered: 0,
			present: 0,
			waitlisted: 0,
			pending: 0,
			absent: 0,
			absentShare: null,
		});
	});
});
