import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F5] po zalogowaniu „Moje wydarzenia” pokazują zapisy z biletem @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({ maxSeats: 5 });
	await registerForEvent(event.id, user.id, "pl");

	// Signing in without a destination lands on the person's own events
	await signInByEmail(page, email);
	await expect(page).toHaveURL(/\/pl\/my-events/);
	await expect(
		page.getByRole("heading", { level: 1, name: "Moje wydarzenia" }),
	).toBeVisible();
	const upcoming = page.getByRole("region", { name: "Nadchodzące" });
	await expect(upcoming.getByText(event.title)).toBeVisible();
	await expect(upcoming.getByRole("link", { name: "Bilet" })).toBeVisible();

	// The header leads back here from anywhere
	await open(page, "/pl");
	await page.getByRole("link", { name: "Moje wydarzenia" }).click();
	await expect(page).toHaveURL(/\/pl\/my-events/);
});

test("[F1] konto ma zakładki ustawień zamiast jednej długiej strony @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);
	await open(page, "/pl/account");

	const tabs = page.getByRole("tablist", { name: "Ustawienia konta" });
	await expect(tabs.getByRole("tab", { name: "Profil" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await expect(page.getByText(email)).toBeVisible();
	// No internal identifiers on show
	await expect(page.getByText("ID użytkownika")).toHaveCount(0);

	await tabs.getByRole("tab", { name: "Bezpieczeństwo" }).click();
	await expect(page).toHaveURL(/tab=security/);
	await expect(page.getByLabel("Nowe hasło")).toBeVisible();
	await tabs.getByRole("tab", { name: "Prywatność" }).click();
	await expect(
		page.getByRole("button", { name: /Pobierz moje dane/ }),
	).toBeVisible();
});
