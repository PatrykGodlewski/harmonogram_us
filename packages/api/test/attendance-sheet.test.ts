import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import { pageRows, renderAttendanceSheetPdf } from "../src/admin/attendance-sheet-pdf";

describe("attendance sheet", () => {
	it("splits rows into pages, the first one shorter for the header", () => {
		expect(pageRows(60, 20, 25)).toEqual([20, 25, 15]);
		expect(pageRows(0, 20, 25)).toEqual([0]);
	});

	it("lists people with a signature column, on as many pages as needed", async () => {
		const people = Array.from({ length: 45 }, (_, index) => ({
			name: `Osoba ${String(index + 1).padStart(2, "0")} Żółć`,
			email: `o${index}@x.test`,
		}));
		const pdf = await renderAttendanceSheetPdf({
			eventTitle: "Warsztaty",
			eventDate: new Date("2026-12-01T09:00:00Z"),
			people,
			locale: "pl",
		});
		const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: true });
		expect(totalPages).toBeGreaterThan(1);
		expect(text).toContain("Lista obecności");
		expect(text).toContain("Podpis");
		expect(text).toContain("Osoba 45 Żółć");
	});
});

describe("attendance sheet layout", () => {
	it("a very long name and title stay inside their column and the page", async () => {
		const { getDocumentProxy } = await import("unpdf");
		const longName = "Aleksandra Konstancja Maria Wiśniewska-Brzęczyszczykiewicz-Nowak";
		const pdf = await renderAttendanceSheetPdf({
			eventTitle: "Bardzo długi tytuł wydarzenia ".repeat(6).trim(),
			eventDate: new Date("2026-12-01T09:00:00Z"),
			people: [{ name: longName, email: "a@x.test" }],
			locale: "pl",
		});
		const document = await getDocumentProxy(new Uint8Array(pdf));
		const page = await document.getPage(1);
		const { items } = await page.getTextContent();
		const texts = items.filter(
			(item): item is { str: string; width: number; transform: number[] } =>
				"str" in item && item.str.trim() !== "",
		);
		const pageWidth = page.view[2] ?? 595;
		for (const item of texts) {
			expect(item.transform[4] + item.width, item.str).toBeLessThanOrEqual(pageWidth - 40 + 1);
		}
		// The name column ends where the e-mail column starts (x = 250).
		const name = texts.find((item) => item.str.startsWith("Aleksandra"));
		expect((name?.transform[4] ?? 0) + (name?.width ?? 0)).toBeLessThanOrEqual(250);
	});
});
