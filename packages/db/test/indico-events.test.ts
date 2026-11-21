import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	type ImportedEvent,
	listIndicoCalendarEntries,
	listIndicoEvents,
	replaceIndicoEvents,
} from "../src/queries/indico-events";

const DAY = 86_400_000;

function imported(id: string, startsAt: Date, title = `Event ${id}`): ImportedEvent {
	return {
		id,
		title,
		startsAt,
		endsAt: null,
		location: "Aula",
		room: null,
		url: `https://indico.example/event/${id}/`,
	};
}

beforeEach(async () => {
	await db.execute(sql`TRUNCATE indico_events`);
});

describe("indico events mirror", () => {
	it("replaces the mirror with the latest import", async () => {
		const soon = new Date(Date.now() + DAY);
		await replaceIndicoEvents([imported("1", soon), imported("2", soon)]);
		await replaceIndicoEvents([imported("2", soon, "Renamed"), imported("3", soon)]);

		const rows = await listIndicoEvents({ sortOrder: "asc" }, 10);
		expect(rows.map((row) => [row.id, row.title]).sort()).toEqual([
			["2", "Renamed"],
			["3", "Event 3"],
		]);
	});

	it("lists by search, date window and order", async () => {
		const now = Date.now();
		await replaceIndicoEvents([
			imported("1", new Date(now + 2 * DAY), "Seminarium fizyki"),
			imported("2", new Date(now + 3 * DAY), "Seminarium chemii"),
			imported("3", new Date(now + 20 * DAY), "Seminarium późne"),
			imported("4", new Date(now + 4 * DAY), "Wykład"),
		]);

		const week = await listIndicoEvents({ search: "seminarium", whenFilter: "7d", sortOrder: "desc" }, 10);
		expect(week.map((row) => row.id)).toEqual(["2", "1"]);
	});

	it("limits the list", async () => {
		const now = Date.now();
		await replaceIndicoEvents(["1", "2", "3"].map((id, i) => imported(id, new Date(now + (i + 1) * DAY))));

		const rows = await listIndicoEvents({ sortOrder: "asc" }, 2);
		expect(rows.map((row) => row.id)).toEqual(["1", "2"]);
	});

	it("calendar entries skip ended events", async () => {
		const now = new Date();
		await replaceIndicoEvents([
			{ ...imported("past", new Date(now.getTime() - 3 * DAY)), endsAt: new Date(now.getTime() - 2 * DAY) },
			imported("yesterday-no-end", new Date(now.getTime() - 2 * DAY)),
			{ ...imported("running", new Date(now.getTime() - DAY)), endsAt: new Date(now.getTime() + DAY) },
			imported("next", new Date(now.getTime() + DAY)),
		]);

		const entries = await listIndicoCalendarEntries(now);
		expect(entries.map((entry) => entry.id)).toEqual(["running", "next"]);
	});
});
