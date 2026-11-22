import { beforeEach, describe, expect, it } from "vitest";
import { getEventPage } from "../src/queries/events";
import { createEvent, hoursFromNow, resetDb } from "./helpers";

beforeEach(resetDb);

describe("getEventPage", () => {
	it("returns the first page in a stable order and says whether more exist", async () => {
		const sameTime = hoursFromNow(48);
		const ids = [];
		for (let index = 0; index < 5; index++) {
			ids.push(await createEvent({ date: sameTime }));
		}
		const first = await getEventPage({ audience: { kind: "public", signedIn: false }, sortOrder: "asc" }, 3);
		const all = await getEventPage({ audience: { kind: "public", signedIn: false }, sortOrder: "asc" }, 10);
		expect(first.events).toHaveLength(3);
		expect(first.hasMore).toBe(true);
		expect(all.hasMore).toBe(false);
		expect(all.events.slice(0, 3).map((event) => event.id)).toEqual(
			first.events.map((event) => event.id),
		);
		expect(new Set(all.events.map((event) => event.id))).toEqual(new Set(ids));
	});
});
