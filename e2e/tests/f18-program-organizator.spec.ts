import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F18] organizator dodaje punkt programu do swojego wydarzenia @organizator", async ({
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
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await expect(
		page
			.getByRole("region", { name: "Program" })
			.getByText("Wykład otwierający"),
	).toBeVisible();
});

test("[F18] brak godziny zakończenia pokazuje błąd zamiast nic nie robić @organizator", async ({
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
	await dialog.getByLabel("Tytuł").fill("Bez końca");
	await dialog.getByLabel("Godzina rozpoczęcia").fill("10:00");
	await dialog.getByRole("button", { name: "Zapisz" }).click();

	await expect(dialog.getByRole("alert")).toHaveText("Podaj godzinę.");
	await expect(dialog).toBeVisible();
});
