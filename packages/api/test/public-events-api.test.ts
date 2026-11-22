import { env } from "@repo/env";
import { baseLocale } from "@repo/i18n/paraglide/runtime";
import type { PublicEvent } from "@repo/db/queries/public-events";
import { describe, expect, it } from "vitest";
import { publicEventsResponse } from "../src/public/events-api";

const EVENT: PublicEvent = {
	id: "ev-1",
	title: "Seminarium",
	startsAt: new Date("2026-12-01T09:00:00Z"),
	endsAt: new Date("2026-12-01T11:00:00Z"),
	place: "Aula · B105",
	attendanceMode: "onsite",
	faculty: { slug: "fiz", label: "Wydział Fizyki" },
	type: null,
	seatsRemaining: 7,
};

function respond(query: string) {
	const calls: unknown[] = [];
	const response = publicEventsResponse(new Request(`https://site.test/api/v1/events${query}`), {
		list: async (_now, filters) => {
			calls.push(filters);
			return [EVENT];
		},
	});
	return { calls, response };
}

describe("public events API", () => {
	it("returns events with absolute links, CORS and caching", async () => {
		const { calls, response } = respond("?lang=en&faculty=fiz&type=wyklad&limit=3");
		const res = await response;
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBe("*");
		expect(res.headers.get("cache-control")).toBe("public, max-age=60");
		expect(res.headers.get("content-type")).toContain("application/json");
		expect(calls).toEqual([{ limit: 3, facultySlug: "fiz", typeSlug: "wyklad" }]);
		expect(await res.json()).toEqual({
			events: [
				{
					id: "ev-1",
					title: "Seminarium",
					startsAt: "2026-12-01T09:00:00.000Z",
					endsAt: "2026-12-01T11:00:00.000Z",
					place: "Aula · B105",
					attendanceMode: "onsite",
					faculty: { slug: "fiz", label: "Wydział Fizyki" },
					type: null,
					seatsRemaining: 7,
					url: `${env.BETTER_AUTH_URL}/en/events/ev-1`,
				},
			],
		});
	});

	it("defaults to 20 events in the base language", async () => {
		const { calls, response } = respond("");
		const body = (await (await response).json()) as { events: { url: string }[] };
		expect(calls).toEqual([{ limit: 20 }]);
		expect(body.events[0]?.url).toBe(`${env.BETTER_AUTH_URL}/${baseLocale}/events/ev-1`);
	});

	it("refuses bad parameters with 400 and never queries", async () => {
		for (const query of ["?limit=0", "?limit=51", "?limit=abc", "?limit=2.5", "?lang=de", "?faculty="]) {
			const { calls, response } = respond(query);
			const res = await response;
			expect(res.status, query).toBe(400);
			expect(res.headers.get("access-control-allow-origin")).toBe("*");
			expect(await res.json()).toHaveProperty("error");
			expect(calls).toEqual([]);
		}
	});
});
