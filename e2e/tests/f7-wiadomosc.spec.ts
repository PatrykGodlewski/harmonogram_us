import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo, messageCountTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F7] wiadomość dociera do wszystkich zapisanych @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		maxSeats: 2,
		organizerId: organizer.id,
	});
	for (const who of ["a", "b", "w"]) {
		const user = await createTestUser(`${who}-${base}`);
		await registerForEvent(event.id, user.id, "pl");
	}
	const waitlistedBefore = await messageCountTo(`w-${base}`);

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Wyślij wiadomość" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("combobox", { name: "Do kogo" }).click();
	await page.getByRole("option", { name: "Zarejestrowani" }).click();
	await dialog.getByLabel("Temat").fill("Zmiana sali");
	await dialog.getByLabel("Treść").fill("Spotykamy się w auli 101.");
	await dialog.getByRole("button", { name: "Wyślij" }).click();
	await expect(page.getByText("Wysłano do 2 osób.")).toBeVisible();

	for (const who of ["a", "b"]) {
		const message = await latestMessageTo(`${who}-${base}`, {
			subject: "Zmiana sali",
		});
		expect(message.subject).toBe(`[${event.title}] Zmiana sali`);
		expect(message.text).toContain("Spotykamy się w auli 101.");
	}
	expect(await messageCountTo(`w-${base}`)).toBe(waitlistedBefore);
});
