import { describe, expect, it } from "vitest";
import { cleanFileName, fileTypeFor, MAX_FILE_BYTES } from "../src/files/rules";

describe("fileTypeFor", () => {
	it("gives the content type of allowed extensions, whatever their case", () => {
		expect(fileTypeFor("Slajdy.PDF")).toBe("application/pdf");
		expect(fileTypeFor("referat.docx")).toBe(
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		);
		expect(fileTypeFor("plan.odp")).toBe("application/vnd.oasis.opendocument.presentation");
		expect(fileTypeFor("dane.csv")).toBe("text/csv");
		expect(fileTypeFor("zdjecie.jpeg")).toBe("image/jpeg");
		expect(fileTypeFor("kod.zip")).toBe("application/zip");
	});

	it("refuses anything that could run in a browser or has no extension", () => {
		for (const name of ["x.html", "x.svg", "x.js", "x.exe", "x.pdf.html", "README", ".pdf"]) {
			expect(fileTypeFor(name), name).toBeNull();
		}
	});
});

describe("cleanFileName", () => {
	it("keeps only the base name without control characters", () => {
		expect(cleanFileName("../../etc/x.pdf")).toBe("x.pdf");
		expect(cleanFileName("C:\\Users\\a\\Prezentacja żółć.pdf")).toBe("Prezentacja żółć.pdf");
		expect(cleanFileName("a\u0000b\u202Ec.pdf")).toBe("abc.pdf");
		expect(cleanFileName("  slajdy.pdf  ")).toBe("slajdy.pdf");
	});

	it("cuts long names to 200 characters keeping the extension", () => {
		const cleaned = cleanFileName(`${"a".repeat(300)}.pdf`);
		expect(cleaned).toHaveLength(200);
		expect(cleaned.endsWith(".pdf")).toBe(true);
	});

	it("allows 25 MB", () => {
		expect(MAX_FILE_BYTES).toBe(25 * 1024 * 1024);
	});
});
