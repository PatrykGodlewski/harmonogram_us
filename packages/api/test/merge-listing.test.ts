import { describe, expect, it } from "vitest";
import { includeIndico, mergeByDate } from "../src/events/merge-listing";

const at = (day: number) => new Date(Date.UTC(2026, 11, day, 10));
const local = (id: string, day: number) => ({ id, date: at(day) });
const indico = (id: string, day: number) => ({ id, startsAt: at(day) });

const ids = (page: ReturnType<typeof mergeByDate>) =>
	page.events.map((event) => `${event.source}:${event.id}`);

describe("mergeByDate", () => {
	it("interleaves both sources by date, newest first", () => {
		const page = mergeByDate([local("a", 5), local("b", 1)], [indico("1", 3)], "desc", 10);
		expect(ids(page)).toEqual(["local:a", "indico:1", "local:b"]);
		expect(page.hasMore).toBe(false);
	});

	it("interleaves oldest first", () => {
		const page = mergeByDate([local("b", 1), local("a", 5)], [indico("1", 3)], "asc", 10);
		expect(ids(page)).toEqual(["local:b", "indico:1", "local:a"]);
	});

	it("cuts at the limit and says there is more when either source has more", () => {
		const page = mergeByDate([local("a", 1)], [indico("1", 2), indico("2", 3)], "asc", 2);
		expect(ids(page)).toEqual(["local:a", "indico:1"]);
		expect(page.hasMore).toBe(true);
	});

	it("a longer page starts with the shorter one (show more neither repeats nor skips)", () => {
		const locals = [local("a", 1), local("b", 4), local("c", 6)];
		const indicos = [indico("1", 2), indico("2", 5)];
		const short = ids(mergeByDate(locals.slice(0, 3), indicos.slice(0, 3), "asc", 2));
		const long = ids(mergeByDate(locals, indicos, "asc", 4));
		expect(long.slice(0, 2)).toEqual(short);
		expect(long).toEqual(["local:a", "indico:1", "local:b", "indico:2"]);
	});
});

describe("includeIndico", () => {
	it("keeps Indico events for search and dates only", () => {
		expect(includeIndico({ search: "x", whenFilter: "7d" })).toBe(true);
		expect(includeIndico({ eventTypeFilter: "all", locationFilter: "all", facultyFilter: "all", modeFilter: "all" })).toBe(true);
	});

	it("drops them when a type, place, unit or format is picked", () => {
		expect(includeIndico({ eventTypeFilter: "wyklad" })).toBe(false);
		expect(includeIndico({ locationFilter: "aula" })).toBe(false);
		expect(includeIndico({ facultyFilter: "wmfi" })).toBe(false);
		expect(includeIndico({ modeFilter: "online" })).toBe(false);
	});
});
