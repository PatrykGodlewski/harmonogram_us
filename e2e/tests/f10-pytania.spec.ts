import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
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
	await page
		.getByRole("button", { name: "Dodaj pytanie", exact: true })
		.click();
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

test("[F10] wymagane pytanie blokuje zapis; odpowiedzi są na liście i w CSV @uczestnik", async ({
	browser,
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	const { createEventQuestion } = await import(
		"@repo/db/queries/event-questions"
	);
	await createEventQuestion({
		eventId: event.id,
		label: "Kierunek studiów",
		kind: "text",
		required: true,
	});
	await createEventQuestion({
		eventId: event.id,
		label: "Rozmiar koszulki",
		kind: "choice",
		options: ["S", "M", "L"],
	});
	const participant = `p-${base}`;
	await createTestUser(participant);

	// From the list, registering leads to the event page (answers come first)
	const visitor = await (await browser.newContext()).newPage();
	await signInByEmail(visitor, participant);
	await open(visitor, `/pl?search=${encodeURIComponent(event.title)}`);
	await visitor.getByRole("link", { name: "Zarejestruj się" }).first().click();
	await expect(visitor).toHaveURL(new RegExp(`/pl/events/${event.id}`));

	// The required answer is asked for before anything is saved
	const summary = visitor.locator("section").first();
	await summary.getByRole("button", { name: "Zarejestruj się" }).click();
	const form = visitor.getByRole("dialog");
	await form.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(form.getByText("Ta odpowiedź jest wymagana.")).toBeVisible();
	await form.getByLabel(/Kierunek studiów/).fill("Fizyka");
	await form.getByRole("combobox", { name: /Rozmiar koszulki/ }).click();
	// An optional choice can be left without an answer again
	await expect(
		visitor.getByRole("option", { name: "Bez odpowiedzi" }),
	).toBeVisible();
	await visitor.getByRole("option", { name: "M" }).click();
	await form.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(summary.getByText("Zarejestrowano")).toBeVisible();

	// The organiser sees the answers and gets them in the CSV
	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const row = page.getByRole("listitem").filter({ hasText: participant });
	await expect(row.getByText("Kierunek studiów: Fizyka")).toBeVisible();
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("button", { name: "Pobierz CSV" }).click();
	const download = await downloadPromise;
	const { readFile } = await import("node:fs/promises");
	const csv = (await readFile((await download.path()) ?? "", "utf8")).replace(
		/^﻿/,
		"",
	);
	const [header, first] = csv.split("\r\n");
	expect(header).toContain('"Kierunek studiów";"Rozmiar koszulki"');
	expect(first).toContain('"Fizyka";"M"');
});

test("[F10] uczestnik i organizator zmieniają odpowiedzi @uczestnik", async ({
	browser,
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	const { createEventQuestion } = await import(
		"@repo/db/queries/event-questions"
	);
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	const question = await createEventQuestion({
		eventId: event.id,
		label: "Kierunek studiów",
		kind: "text",
		required: true,
	});
	const participant = `p-${base}`;
	const user = await createTestUser(participant);
	await registerForEvent(event.id, user.id, "pl", undefined, {
		answers: { [question.id]: "Fizyka" },
	});

	// The participant changes their answer on the event page
	const visitor = await (await browser.newContext()).newPage();
	await signInByEmail(visitor, participant);
	await open(visitor, `/pl/events/${event.id}`);
	await visitor.getByRole("button", { name: "Zmień odpowiedzi" }).click();
	const form = visitor.getByRole("dialog");
	await expect(form.getByLabel(/Kierunek studiów/)).toHaveValue("Fizyka");
	await form.getByLabel(/Kierunek studiów/).fill("Chemia");
	await form.getByRole("button", { name: "Zapisz odpowiedzi" }).click();
	await expect(visitor.getByText("Zapisano odpowiedzi")).toBeVisible();

	// The organiser sees it and corrects it from the list
	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const row = page
		.getByRole("listitem")
		.filter({ hasText: participant })
		.first();
	await expect(row.getByText("Kierunek studiów: Chemia")).toBeVisible();
	await row.getByRole("button", { name: "Edytuj odpowiedzi" }).click();
	const adminForm = page.getByRole("dialog");
	await adminForm.getByLabel(/Kierunek studiów/).fill("Biologia");
	await adminForm.getByRole("button", { name: "Zapisz odpowiedzi" }).click();
	await expect(row.getByText("Kierunek studiów: Biologia")).toBeVisible();
});
