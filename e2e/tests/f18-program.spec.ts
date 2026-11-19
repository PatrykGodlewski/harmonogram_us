import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F18] program w widoku listy i kalendarza @uczestnik", async ({
	page,
}, testInfo) => {
	// Given an event with an opening and two parallel limited workshops
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({
		maxSeats: 10,
		agenda: [
			{ title: "Otwarcie", startHour: 0, durationMinutes: 60 },
			{ title: "Warsztat A", startHour: 1.5, durationMinutes: 90, maxSeats: 2 },
			{ title: "Warsztat B", startHour: 1.5, durationMinutes: 90, maxSeats: 2 },
		],
	});
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);

	// The list is the default view
	await expect(
		page.getByRole("listitem").filter({ hasText: "Otwarcie" }),
	).toBeVisible();

	// When they switch to the calendar
	await page.getByRole("button", { name: "Kalendarz" }).click();
	await expect(page).toHaveURL(/agenda=calendar/);

	// Then the parallel workshops sit side by side, inside the window
	const a = page.getByRole("button", { name: /Warsztat A/ });
	const b = page.getByRole("button", { name: /Warsztat B/ });
	await expect(a).toBeVisible();
	const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
	const width = page.viewportSize()?.width ?? 0;
	expect(boxA?.y).toBe(boxB?.y);
	expect(boxA?.x).not.toBe(boxB?.x);
	for (const box of [boxA, boxB]) {
		expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
	}

	// And registering from the calendar works like in the list
	await a.click();
	const dialog = page.getByRole("dialog");
	await expect(dialog.getByText("Wolne miejsca: 2 / 2")).toBeVisible();
	await dialog.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(dialog.getByText("Wolne miejsca: 1 / 2")).toBeVisible();

	// And the calendar view survives a reload
	await page.reload();
	await page.locator("html[data-hydrated=true]").waitFor();
	await expect(page.getByRole("button", { name: /Warsztat B/ })).toBeVisible();
});
