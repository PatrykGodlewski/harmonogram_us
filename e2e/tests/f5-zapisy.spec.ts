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

test("[F5] zapis na pełne wydarzenie trafia na listę rezerwową @uczestnik", async ({
	page,
}, testInfo) => {
	// Given an event whose only place is taken
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, other.id, "pl");
	// When the user joins the waitlist
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await expect(summary.getByText("Wolne miejsca: 0 / 1")).toBeVisible();
	await summary
		.getByRole("button", { name: "Zapisz na listę rezerwową" })
		.click();
	// Then they see their position
	await expect(
		summary.getByText("Jesteś na liście rezerwowej (pozycja 1)"),
	).toBeVisible();
	await expect(
		summary.getByRole("button", { name: "Wypisz się z listy" }),
	).toBeVisible();
});

test("[F5] po rezygnacji pierwsza osoba z listy awansuje @uczestnik", async ({
	page,
	browser,
}, testInfo) => {
	// Given A registered and B, C on the waitlist of a 1-place event
	const base = uniqueEmail(testInfo);
	const [a, b, c] = ["a", "b", "c"].map((p) => `${p}-${base}`);
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	const ids: string[] = [];
	for (const email of [a, b, c]) {
		const user = await createTestUser(email ?? "");
		ids.push(user.id);
		await registerForEvent(event.id, user.id, "pl");
	}
	// When A withdraws in the browser
	await signInByEmail(page, a ?? "");
	await open(page, `/pl/events/${event.id}`);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Wypisz się" })
		.click();
	await expect(
		page
			.locator("section")
			.first()
			.getByRole("button", { name: "Zapisz na listę rezerwową" }),
	).toBeVisible();
	// Then B is registered and C is first on the waitlist
	for (const [email, expected] of [
		[b, "Zarejestrowano"],
		[c, "Jesteś na liście rezerwowej (pozycja 1)"],
	] as const) {
		const context = await browser.newContext({ locale: "pl-PL" });
		const other = await context.newPage();
		await signInByEmail(other, email ?? "");
		await open(other, `/pl/events/${event.id}`);
		await expect(
			other.locator("section").first().getByText(expected),
		).toBeVisible();
		await context.close();
	}
});
