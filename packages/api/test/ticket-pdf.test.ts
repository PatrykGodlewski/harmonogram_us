import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import { renderTicketPdf } from "../src/tickets/pdf";

describe("renderTicketPdf", () => {
	it("names the holder, the event, its date and place, and spells out the code", async () => {
		const code = "a".repeat(32) + "b".repeat(32);
		const pdf = await renderTicketPdf({
			holderName: "Zażółć Gęślą",
			title: "Koncert jesienny",
			date: new Date("2026-12-01T17:00:00Z"),
			place: "Aula · B105",
			ticketCode: code,
			locale: "pl",
		});
		const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
		expect(text).toContain("Bilet");
		expect(text).toContain("Zażółć Gęślą");
		expect(text).toContain("Koncert jesienny");
		expect(text).toContain("Aula · B105");
		expect(text).toContain("1 grudnia 2026");
		expect(text.replace(/\s/g, "")).toContain(code);
	});
});
