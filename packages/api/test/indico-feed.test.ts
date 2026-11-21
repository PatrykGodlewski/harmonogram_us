import { describe, expect, it } from "vitest";
import { indicoIcsEvent } from "../src/calendar/feeds";

describe("indicoIcsEvent", () => {
	it("links to Indico with its own uid and the place", () => {
		const start = new Date("2026-12-01T09:00:00Z");
		expect(
			indicoIcsEvent({
				id: "1001",
				title: "Seminarium",
				startsAt: start,
				endsAt: new Date("2026-12-01T11:00:00Z"),
				location: "Aula",
				room: "A1",
				url: "https://indico.example/event/1001/",
			}),
		).toEqual({
			uid: "indico-1001",
			title: "Seminarium",
			description: null,
			start,
			end: new Date("2026-12-01T11:00:00Z"),
			location: "Aula · A1",
			url: "https://indico.example/event/1001/",
			cancelled: false,
		});
	});

	it("ends a day after the start when Indico gives no end", () => {
		const start = new Date("2026-12-01T09:00:00Z");
		const event = indicoIcsEvent({ id: "1", title: "x", startsAt: start, endsAt: null, location: null, room: null, url: "u" });
		expect(event.end).toEqual(new Date("2026-12-02T09:00:00Z"));
		expect(event.location).toBeNull();
	});
});
