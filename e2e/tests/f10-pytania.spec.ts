import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

async function addQuestion(
	page: Page,
	question: {
		label: string;
		kind: string;
		options?: string;
		required?: boolean;
	},
) {
	await page.getByRole("button", { name: "Dodaj pytanie" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Treść pytania").fill(question.label);
	await dialog.getByRole("combobox", { name: "Rodzaj odpowiedzi" }).click();
	await page.getByRole("option", { name: question.kind }).click();
	if (question.options) {
		await dialog.getByLabel("Możliwe odpowiedzi").fill(question.options);
	}
	if (question.required) {
		await dialog.getByLabel("Odpowiedź wymagana").check();
	}
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
}

test("[F10] organizator dodaje pytania @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const card = page.getByRole("region", { name: "Pytania przy zapisie" });
	await addQuestion(page, {
		label: "Kierunek studiów",
		kind: "Tekst",
		required: true,
	});
	await addQuestion(page, {
		label: "Rozmiar koszulki",
		kind: "Wybór z listy",
		options: "S\nM\nL",
	});
	await addQuestion(page, { label: "Zgoda na zdjęcia", kind: "Tak / nie" });

	const items = card.getByRole("listitem");
	await expect(items).toHaveCount(3);
	await expect(items.nth(0)).toContainText("Kierunek studiów");
	await expect(items.nth(0)).toContainText("Wymagane");
	await expect(items.nth(1)).toContainText("S, M, L");

	// Reorder and delete
	await items.nth(1).getByRole("button", { name: "W górę" }).click();
	await expect(items.nth(0)).toContainText("Rozmiar koszulki");
	await items.nth(2).getByRole("button", { name: "Usuń" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Usuń" })
		.click();
	await expect(items).toHaveCount(2);
});
