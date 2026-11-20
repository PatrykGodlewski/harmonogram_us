import { describe, expect, it } from "vitest";
import type { EventRegistrant } from "@repo/db/queries/event-registrations";
import { toRegistrantsCsv } from "../src/registrants-csv";

const base: EventRegistrant = {
	registrationId: "r1",
	userId: "u1",
	email: "ala@x.test",
	name: "Zażółć Gęślą",
	registeredAt: new Date("2026-12-01T09:30:00Z"),
	state: "registered",
	agendaItemIds: ["i1"],
	groupId: null,
	groupName: null,
};

describe("toRegistrantsCsv", () => {
	it("starts with a UTF-8 BOM, uses ; and CRLF, and keeps Polish letters", () => {
		const csv = toRegistrantsCsv([base], [{ id: "i1", title: "Warsztat" }], "pl");
		expect(csv.startsWith("﻿")).toBe(true);
		const lines = csv.slice(1).split("\r\n");
		expect(lines[0]).toBe(
			'"Imię i nazwisko";"E-mail";"Status";"Data zapisu";"Grupa";"Punkty programu"',
		);
		expect(lines[1]).toBe(
			'"Zażółć Gęślą";"ala@x.test";"Zarejestrowano";"1 gru 2026, 10:30";"";"Warsztat"',
		);
	});

	it("doubles quotes and defuses spreadsheet formulas", () => {
		const csv = toRegistrantsCsv(
			[
				{ ...base, name: 'Ala "Kot"' },
				{ ...base, registrationId: "r2", name: '=HYPERLINK("x")', state: "waitlisted" },
			],
			[],
			"pl",
		);
		const lines = csv.slice(1).split("\r\n");
		expect(lines[1]?.startsWith('"Ala ""Kot"""')).toBe(true);
		expect(lines[2]?.startsWith(`"'=HYPERLINK(""x"")";`)).toBe(true);
		expect(lines[2]).toContain('"Lista rezerwowa"');
	});
});
