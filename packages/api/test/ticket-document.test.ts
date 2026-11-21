import jsQR from "jsqr";
import { extractImages, extractText } from "unpdf";
import { Code, ConnectError } from "@connectrpc/connect";
import { documentsClient } from "@repo/rpc/documents";
import { describe, expect, it } from "vitest";
import { pdfResponse } from "../src/documents/http";
import { type TicketPdfInput, ticketDocumentRequest } from "../src/tickets/document";
import { ticketCodeFromQr } from "../src/tickets/qr";

// Renders through the documents service: `docker compose up -d documents`.
async function renderTicketPdf(input: TicketPdfInput): Promise<Uint8Array> {
	const { pdf } = await documentsClient().renderTicket(ticketDocumentRequest(input));
	return pdf;
}

describe("ticket PDF (documents service)", () => {
	it("names the holder, the event, its date and place", async () => {
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
	});

	it("has a QR code the door scanner accepts", async () => {
		const code = "c".repeat(64);
		const pdf = await renderTicketPdf({
			holderName: "Ala",
			title: "Koncert",
			date: new Date("2026-12-01T17:00:00Z"),
			place: null,
			ticketCode: code,
			locale: "pl",
		});
		const [image] = await extractImages(new Uint8Array(pdf), 1);
		if (!image) throw new Error("no QR image in the PDF");
		// unpdf leaves `channels` empty for some images: work it out from the data size.
		const channels = image.data.length / (image.width * image.height);
		const rgba = new Uint8ClampedArray(image.width * image.height * 4);
		for (let pixel = 0; pixel < image.width * image.height; pixel++) {
			for (let channel = 0; channel < 3; channel++) {
				rgba[pixel * 4 + channel] =
					image.data[pixel * channels + (channels >= 3 ? channel : 0)] ?? 0;
			}
			rgba[pixel * 4 + 3] = 255;
		}
		const decoded = jsQR(rgba, image.width, image.height);
		expect(ticketCodeFromQr(decoded?.data ?? "")).toBe(code);
	});
});

describe("pdfResponse", () => {
	it("answers 503 with Retry-After when the service is busy", async () => {
		const response = await pdfResponse(
			() => Promise.reject(new ConnectError("down", Code.Unavailable)),
			"bilet",
			"pl",
		);
		expect(response.status).toBe(503);
		expect(response.headers.get("retry-after")).toBe("5");
		expect(response.headers.get("content-type")).toContain("text/plain");
		expect(await response.text()).toBe(
			"Nie udało się teraz przygotować pliku. Spróbuj ponownie za chwilę.",
		);
	});

	it("serves the PDF as a private download", async () => {
		const response = await pdfResponse(
			() => Promise.resolve(new Uint8Array([37, 80, 68, 70])),
			"bilet",
			"pl",
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-disposition")).toBe(
			'attachment; filename="bilet.pdf"',
		);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("rethrows other errors", async () => {
		await expect(
			pdfResponse(
				() => Promise.reject(new ConnectError("bad", Code.InvalidArgument)),
				"bilet",
				"pl",
			),
		).rejects.toThrow("bad");
	});
});
