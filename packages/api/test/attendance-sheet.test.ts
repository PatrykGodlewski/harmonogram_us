import { documentsClient } from "@repo/rpc/documents";
import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import {
	type AttendanceSheetInput,
	attendanceSheetRequest,
} from "../src/admin/attendance-sheet-document";

// Renders through the documents service: `docker compose up -d documents`.
// Page splitting is tested in Rust (apps/documents/src/sheet.rs).
async function renderAttendanceSheetPdf(input: AttendanceSheetInput): Promise<Uint8Array> {
	const { pdf } = await documentsClient().renderAttendanceSheet(attendanceSheetRequest(input));
	return pdf;
}

describe("attendance sheet", () => {
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
		expect(text).toContain("Strona 2 z 2");
	});

	it("renders 2 000 people within the deadline", async () => {
		const people = Array.from({ length: 2000 }, (_, index) => ({
			name: `Osoba ${index + 1}`,
			email: `o${index}@x.test`,
		}));
		const pdf = await renderAttendanceSheetPdf({
			eventTitle: "Inauguracja roku",
			eventDate: new Date("2026-10-01T09:00:00Z"),
			people,
			locale: "pl",
		});
		const { totalPages } = await extractText(new Uint8Array(pdf), { mergePages: true });
		expect(totalPages).toBe(75);
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
