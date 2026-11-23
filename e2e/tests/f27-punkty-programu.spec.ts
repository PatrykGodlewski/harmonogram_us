import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { LIVE_WAIT } from "../fixtures/live";
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

test("[F5] osoba z listy rezerwowej nie zapisze się na punkt programu", async ({
	page,
}, testInfo) => {
	// Given a full event with an agenda item and the user on its waitlist
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const event = await createTestEvent({
		maxSeats: 1,
		agenda: [{ title: "Warsztaty", maxSeats: 1 }],
	});
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, other.id, "pl");
	await registerForEvent(event.id, user.id, "pl");
	// When they try to register for the item
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	const item = page.getByRole("listitem").filter({ hasText: "Warsztaty" });
	const response = page.waitForResponse(
		(r) => r.url().includes("/_serverFn/") && r.request().method() === "POST",
	);
	await item.getByRole("button", { name: "Zarejestruj się" }).click();
	// Then the server answers with a client error (not a 500) and they are told why
	expect((await response).status()).toBe(409);
	await expect(
		page.getByText("Jesteś na liście rezerwowej tego wydarzenia"),
	).toBeVisible();
	await expect(item.getByText("Wolne miejsca: 1 / 1")).toBeVisible();
});

test("[F27] licznik punktu odświeża się na otwartej stronie, gdy zapisze się ktoś inny @uczestnik", async ({
	page,
}, testInfo) => {
	// Waits for a page refresh (up to 20 s) on top of the usual steps.
	test.slow();
	// Given a visitor with the page of an event with a 3-place agenda item open
	const other = await createTestUser(uniqueEmail(testInfo));
	const event = await createTestEvent({
		maxSeats: 5,
		agenda: [{ title: "Warsztaty", maxSeats: 3 }],
	});
	await open(page, `/pl/events/${event.id}`);
	const item = page.getByRole("listitem").filter({ hasText: "Warsztaty" });
	await expect(item.getByText("Wolne miejsca: 3 / 3")).toBeVisible();
	// When someone else registers for the item
	const { registerForAgendaItem } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForAgendaItem(event.itemIds[0] ?? "", other.id, "pl");
	// Then the open page shows it, without a reload
	await expect(item.getByText("Wolne miejsca: 2 / 3")).toBeVisible(LIVE_WAIT);
});
