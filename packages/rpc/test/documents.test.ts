import { env } from "@repo/env";
import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import {
	createDocumentsClient,
	documentsClient,
	isDocumentsBusy,
} from "../src/documents";

// Needs the service: `docker compose up -d documents`.
const ticket = {
	documentTitle: "Bilet — Koncert jesienny",
	heading: "Bilet",
	eventTitle: "Koncert jesienny",
	dateText: "1 grudnia 2026, 18:00",
	place: "Aula · B105",
	qrText: `harmonogram-ticket:${"a".repeat(64)}`,
	showAtEntry: "Pokaż przy wejściu",
	holderLabel: "Uczestnik",
	holderName: "Zażółć Gęślą",
};

describe("documentsClient", () => {
	it("renders a ticket", async () => {
		const { pdf } = await documentsClient().renderTicket(ticket);
		const { text } = await extractText(pdf, { mergePages: true });
		expect(text).toContain("Zażółć Gęślą");
		expect(text).toContain("Koncert jesienny");
		expect(text).toContain("1 grudnia 2026, 18:00");
		expect(text).toContain("Aula · B105");
	});

	it("retries once when the service is unreachable, then reports busy", async () => {
		const started = Date.now();
		const client = createDocumentsClient(
			"http://127.0.0.1:1",
			env.DOCUMENTS_TOKEN ?? "",
		);
		const error = await client.renderTicket(ticket).catch((e: unknown) => e);
		expect(isDocumentsBusy(error)).toBe(true);
		expect(Date.now() - started).toBeLessThan(6000);
	});

	it("does not call invalid input busy", async () => {
		const error = await documentsClient()
			.renderTicket({ ...ticket, holderName: "a".repeat(2001) })
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(Error);
		expect(isDocumentsBusy(error)).toBe(false);
	});
});
