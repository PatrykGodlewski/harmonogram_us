import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F2] wydarzenie tylko dla zalogowanych nie jest widoczne dla niezalogowanego @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({ visibility: "authenticated" });
	const listUrl = `/pl?search=${encodeURIComponent(event.title)}`;

	// An anonymous visitor doesn't see it, and its address leads to sign-in
	await open(page, listUrl);
	await expect(page.getByText(event.title)).toHaveCount(0);
	await open(page, `/pl/events/${event.id}`);
	await expect(page).toHaveURL(/\/pl\/login\?redirect=/);

	// After signing in, the event is on the list and its page opens
	await signInByEmail(page, email);
	await open(page, listUrl);
	await page.getByRole("link", { name: event.title }).click();
	await expect(
		page.getByRole("heading", { name: event.title, level: 1 }),
	).toBeVisible();

	// After signing out in the same tab, the (cached) list no longer shows it
	await page.getByRole("link", { name: "Wyloguj" }).click();
	await page.waitForURL(/\/pl\/?$/);
	await page.locator("html[data-hydrated=true]").waitFor();
	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(event.title);
	await expect(
		page.getByText("Brak dostępnych wydarzeń").or(page.getByText(event.title)),
	).toBeVisible();
	await expect(page.getByText(event.title)).toHaveCount(0);
});
