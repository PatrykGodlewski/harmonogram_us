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
