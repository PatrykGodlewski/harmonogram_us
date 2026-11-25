import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F3] organizator edytuje wydarzenie ze strony wydarzenia @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	const newTitle = `${event.title} (zmiana)`;

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByLabel("Tytuł")).toHaveValue(event.title);
	await dialog.getByLabel("Tytuł").fill(newTitle);
	await dialog.getByLabel("Sala / pokój").fill("B105");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();

	await expect(
		page.getByRole("heading", { name: newTitle, level: 1 }),
	).toBeVisible();
	await expect(page.getByText("sala B105")).toBeVisible();
});
