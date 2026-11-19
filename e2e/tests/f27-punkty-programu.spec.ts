import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F27] zapis na punkt programu zapisuje też na wydarzenie @uczestnik", async ({
	page,
}, testInfo) => {
	// Given an event with 5 places and an agenda item with 2
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({
		maxSeats: 5,
		agenda: [{ title: "Warsztaty", maxSeats: 2 }],
	});
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	const item = page.getByRole("listitem").filter({ hasText: "Warsztaty" });
	await expect(item.getByText("Wolne miejsca: 2 / 2")).toBeVisible();
	// When they register for the item
	await item.getByRole("button", { name: "Zarejestruj się" }).click();
	// Then both the item and the event have one place fewer
	await expect(item.getByText("Wolne miejsca: 1 / 2")).toBeVisible();
	await expect(
		page.locator("section").first().getByText("Wolne miejsca: 4 / 5"),
	).toBeVisible();
});
