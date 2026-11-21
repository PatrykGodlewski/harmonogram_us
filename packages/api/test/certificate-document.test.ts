import { extractText } from "unpdf";
import { documentsClient } from "@repo/rpc/documents";
import { describe, expect, it } from "vitest";
import {
	type CertificateInput,
	certificateDocumentRequest,
} from "../src/certificates/document";

// Renders through the documents service: `docker compose up -d documents`.
async function renderCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
	const { pdf } = await documentsClient().renderCertificate(
		certificateDocumentRequest(input),
	);
	return pdf;
}

describe("certificate PDF (documents service)", () => {
	it("names the person, the event and its date, with Polish letters", async () => {
		const pdf = await renderCertificatePdf({
			name: "Zażółć Gęślą Jaźń",
			eventTitle: "Warsztaty łączności",
			eventDate: new Date("2026-12-01T09:30:00Z"),
			reference: "ab12cd34",
			locale: "pl",
		});
		const { text } = await extractText(new Uint8Array(pdf), {
			mergePages: true,
		});
		expect(text).toContain("Zaświadczenie o udziale");
		expect(text).toContain("Zażółć Gęślą Jaźń");
		expect(text).toContain("Warsztaty łączności");
		expect(text).toContain("1 grudnia 2026");
	});

	it("is in English for an English registration", async () => {
		const pdf = await renderCertificatePdf({
			name: "Ada Lovelace",
			eventTitle: "Workshop",
			eventDate: new Date("2026-12-01T09:30:00Z"),
			reference: "ab12cd34",
			locale: "en",
		});
		const { text } = await extractText(new Uint8Array(pdf), {
			mergePages: true,
		});
		expect(text).toContain("Certificate of attendance");
		expect(text).toContain("1 December 2026");
	});

	it("shows the organiser's issuer, signer and note", async () => {
		const pdf = await renderCertificatePdf({
			name: "Ada Lovelace",
			eventTitle: "Warsztaty",
			eventDate: new Date("2026-12-01T09:30:00Z"),
			reference: "ab12cd34",
			locale: "pl",
			issuer: "Wydział Nauk Ścisłych i Technicznych",
			signer: "dr Jan Nowak, kierownik warsztatów",
			note: "Liczba godzin: 4",
		});
		const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
		expect(text).toContain("Wydział Nauk Ścisłych i Technicznych");
		expect(text).toContain("dr Jan Nowak, kierownik warsztatów");
		expect(text).toContain("Liczba godzin: 4");
	});

	it("keeps a very long name whole (on two lines) instead of cutting it", async () => {
		const name =
			"Aleksandra Konstancja Maria Józefina Wiśniewska-Brzęczyszczykiewicz von Hohenzollern-Sigmaringen zu Schwarzenberg-Lichtenstein";
		const pdf = await renderCertificatePdf({
			name,
			eventTitle: "Warsztaty",
			eventDate: new Date("2026-12-01T09:30:00Z"),
			reference: "ab12cd34",
			locale: "pl",
		});
		const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
		expect(text).not.toContain("…");
		expect(text.replace(/\s+/g, " ")).toContain(name);
	});
});
