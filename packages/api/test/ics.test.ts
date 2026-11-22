import { describe, expect, it } from "vitest";
import { toIcs } from "../src/calendar/ics";

const event = {
	uid: "e1",
	title: "Wykład, część 1; sala B",
	description: "Linia pierwsza\nLinia druga",
	start: new Date("2026-12-01T09:00:00Z"),
	end: new Date("2026-12-01T10:30:00Z"),
	location: "Aula · B105",
	url: "https://events.example.test/pl/events/e1",
	cancelled: false,
};

describe("toIcs", () => {
	it("writes a calendar with escaped text, UTC times and the event link", () => {
		const ics = toIcs([event], "Wydarzenia");
		const lines = ics.split("\r\n");
		expect(lines[0]).toBe("BEGIN:VCALENDAR");
		expect(ics).toContain("SUMMARY:Wykład\\, część 1\\; sala B");
		expect(ics).toContain("DESCRIPTION:Linia pierwsza\\nLinia druga");
		expect(ics).toContain("DTSTART:20261201T090000Z");
		expect(ics).toContain("DTEND:20261201T103000Z");
		expect(ics).toContain("URL:https://events.example.test/pl/events/e1");
		expect(ics).toContain("UID:e1@harmonogram");
		expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
	});

	it("folds lines longer than 75 octets and marks cancelled events", () => {
		const ics = toIcs(
			[{ ...event, title: "Ż".repeat(60), cancelled: true }],
			"Wydarzenia",
		);
		for (const line of ics.split("\r\n")) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
		expect(ics).toContain("STATUS:CANCELLED");
		expect(ics).toMatch(/\r\n Ż/);
	});
});
