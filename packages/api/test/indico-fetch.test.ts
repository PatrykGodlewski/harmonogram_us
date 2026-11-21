import { describe, expect, it } from "vitest";
import { fetchIndicoEvents, zonedTimeToUtc } from "../src/indico/fetch";

const CONFIG = {
	baseUrl: "https://indico.example.edu",
	categoryIds: ["12", "34"],
	token: "t",
};

function indicoEvent(overrides: Record<string, unknown> = {}) {
	return {
		_type: "Conference",
		id: "137344",
		title: "Test EPayment",
		description: "<p>html</p>",
		startDate: { date: "2026-06-17", tz: "Europe/Zurich", time: "08:00:00" },
		endDate: { date: "2026-06-30", tz: "Europe/Zurich", time: "18:00:00" },
		location: "CERN",
		room: "1-1-025",
		url: "http://pcituds07.cern.ch/indico/conferenceDisplay.py?confId=137344",
		timezone: "Europe/Zurich",
		type: "conference",
		category: "TEST Category",
		keywords: [],
		...overrides,
	};
}

function respondWith(body: unknown, status = 200) {
	const calls: { url: string; init?: RequestInit }[] = [];
	const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("fetchIndicoEvents", () => {
	it("requests the categories with the token", async () => {
		const { calls, fetchImpl } = respondWith({ count: 0, results: [] });
		await fetchIndicoEvents(CONFIG, fetchImpl);

		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe(
			"https://indico.example.edu/export/categ/12-34.json?from=-30d&to=%2B365d&limit=1000",
		);
		expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer t");
	});

	it("sends no authorization header without a token", async () => {
		const { calls, fetchImpl } = respondWith({ count: 0, results: [] });
		await fetchIndicoEvents({ ...CONFIG, token: undefined }, fetchImpl);
		expect(new Headers(calls[0]?.init?.headers).has("authorization")).toBe(false);
	});

	it("maps events and builds the link from the configured address", async () => {
		const { fetchImpl } = respondWith({ count: 1, results: [indicoEvent()] });
		const events = await fetchIndicoEvents(CONFIG, fetchImpl);

		expect(events).toEqual([
			{
				id: "137344",
				title: "Test EPayment",
				startsAt: new Date("2026-06-17T06:00:00Z"),
				endsAt: new Date("2026-06-30T16:00:00Z"),
				location: "CERN",
				room: "1-1-025",
				url: "https://indico.example.edu/event/137344/",
			},
		]);
	});

	it("keeps a base path and turns empty places into null", async () => {
		const { fetchImpl } = respondWith({
			results: [indicoEvent({ location: "", room: null })],
		});
		const [event] = await fetchIndicoEvents({ ...CONFIG, baseUrl: "https://uni.example/indico/" }, fetchImpl);
		expect(event?.url).toBe("https://uni.example/indico/event/137344/");
		expect(event?.location).toBeNull();
		expect(event?.room).toBeNull();
	});

	it("skips events with a non-numeric id or an unknown time zone", async () => {
		const { fetchImpl } = respondWith({
			results: [
				indicoEvent({ id: "javascript:alert(1)" }),
				indicoEvent({ id: "2", startDate: { date: "2026-06-17", tz: "Mars/Olympus", time: "08:00:00" } }),
				indicoEvent({ id: "3" }),
			],
		});
		const events = await fetchIndicoEvents(CONFIG, fetchImpl);
		expect(events.map((event) => event.id)).toEqual(["3"]);
	});

	it("throws on an HTTP error", async () => {
		const { fetchImpl } = respondWith("nope", 500);
		await expect(fetchIndicoEvents(CONFIG, fetchImpl)).rejects.toThrow(/500/);
	});

	it("throws on a body that is not an export", async () => {
		const { fetchImpl } = respondWith({ error: "x" });
		await expect(fetchIndicoEvents(CONFIG, fetchImpl)).rejects.toThrow();
		const html = respondWith("<html>login</html>");
		await expect(fetchIndicoEvents(CONFIG, html.fetchImpl)).rejects.toThrow();
	});
});

describe("zonedTimeToUtc", () => {
	it("converts local time across DST", () => {
		expect(zonedTimeToUtc("2026-01-10", "10:00:00", "Europe/Warsaw")).toEqual(new Date("2026-01-10T09:00:00Z"));
		expect(zonedTimeToUtc("2026-03-29", "10:00:00", "Europe/Warsaw")).toEqual(new Date("2026-03-29T08:00:00Z"));
		expect(zonedTimeToUtc("2026-10-25", "12:00:00", "Europe/Warsaw")).toEqual(new Date("2026-10-25T11:00:00Z"));
		expect(zonedTimeToUtc("2026-06-01", "23:30:00", "UTC")).toEqual(new Date("2026-06-01T23:30:00Z"));
	});

	it("returns null for an unknown zone or a malformed date", () => {
		expect(zonedTimeToUtc("2026-01-10", "10:00:00", "Mars/Olympus")).toBeNull();
		expect(zonedTimeToUtc("10.01.2026", "10:00:00", "UTC")).toBeNull();
	});
});
