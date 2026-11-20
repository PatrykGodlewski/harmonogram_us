import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F19] punkt programu z prelegentem i linkiem jest na stronie wydarzenia @organizator", async ({
	browser,
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
	await page.getByRole("button", { name: "Dodaj punkt" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill("Wykład otwierający");
	await dialog.getByLabel("Godzina rozpoczęcia").fill("10:00");
	await dialog.getByLabel("Godzina zakończenia").fill("11:00");
	await dialog.getByRole("button", { name: "Dodaj prelegenta" }).click();
	await dialog.getByLabel("Imię i nazwisko prelegenta 1").fill("dr Anna Nowak");
	await dialog.getByLabel("Afiliacja prelegenta 1").fill("Instytut Fizyki");
	await dialog.getByRole("button", { name: "Dodaj materiał" }).click();
	await dialog.getByLabel("Nazwa materiału 1").fill("Slajdy");
	await dialog
		.getByLabel("Adres materiału 1")
		.fill("https://example.test/slajdy.pdf");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText("dr Anna Nowak")).toBeVisible();

	// A visitor sees the speaker and the material on the event page
	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${event.id}`);
	await expect(visitor.getByText("dr Anna Nowak")).toBeVisible();
	await expect(visitor.getByText("Instytut Fizyki")).toBeVisible();
	await expect(visitor.getByRole("link", { name: "Slajdy" })).toHaveAttribute(
		"href",
		"https://example.test/slajdy.pdf",
	);
});
