import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F5] zapis jednym kliknięciem i rezygnacja @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a signed-in user and an event with 3 places
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({ maxSeats: 3 });
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await expect(summary.getByText("Wolne miejsca: 3 / 3")).toBeVisible();
	// When they register with one click
	await summary.getByRole("button", { name: "Zarejestruj się" }).click();
	// Then the count drops and they can withdraw
	await expect(summary.getByText("Wolne miejsca: 2 / 3")).toBeVisible();
	await expect(summary.getByText("Zarejestrowano")).toBeVisible();
	await summary.getByRole("button", { name: "Wypisz się" }).click();
	await expect(summary.getByText("Wolne miejsca: 3 / 3")).toBeVisible();
	await expect(
		summary.getByRole("button", { name: "Zarejestruj się" }),
	).toBeVisible();
});

test("[F5] pełne wydarzenie nie przyjmuje zapisu", async ({
	page,
}, testInfo) => {
	// Given an event whose only place is taken by someone else
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, other.id);
	// When the user opens the event
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	// Then registering is unavailable
	const summary = page.locator("section").first();
	await expect(summary.getByText("Wolne miejsca: 0 / 1")).toBeVisible();
	await expect(
		summary.getByRole("button", { name: "Zarejestruj się" }),
	).toBeDisabled();
});
