import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { LIVE_WAIT } from "../fixtures/live";
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

test("[F5] awans z listy widać na otwartej stronie bez odświeżania @uczestnik", async ({
	page,
}, testInfo) => {
	// Given B on the waitlist of a full 1-place event, with the event page open
	const base = uniqueEmail(testInfo);
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent, unregisterFromEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	const a = await createTestUser(`a-${base}`);
	const b = await createTestUser(`b-${base}`);
	await registerForEvent(event.id, a.id, "pl");
	await registerForEvent(event.id, b.id, "pl");
	await signInByEmail(page, `b-${base}`);
	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await expect(
		summary.getByText("Jesteś na liście rezerwowej (pozycja 1)"),
	).toBeVisible();
	// When A withdraws somewhere else
	await unregisterFromEvent(event.id, a.id);
	// Then B's open page shows the promotion (within one refresh)
	await expect(summary.getByText("Zarejestrowano")).toBeVisible(LIVE_WAIT);
});

test("[F5] liczba wolnych miejsc odświeża się na otwartej stronie, gdy zapisze się ktoś inny @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a visitor with the event page and the list open
	const tag = crypto.randomUUID().slice(0, 6);
	const event = await createTestEvent({ title: `Odczyt ${tag}`, maxSeats: 5 });
	const other = await createTestUser(uniqueEmail(testInfo));
	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await expect(summary.getByText("Wolne miejsca: 5 / 5")).toBeVisible();
	const listPage = await page.context().newPage();
	await open(listPage, "/pl");
	await listPage.getByPlaceholder("Wyszukaj wydarzenie...").fill(tag);
	const card = listPage
		.locator("[data-live-list]")
		.locator('[data-slot="card"]')
		.filter({ hasText: event.title });
	await expect(card.getByText("5 / 5 wolnych miejsc")).toBeVisible();
	// When someone else registers
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, other.id, "pl");
	// Then both open pages show one place fewer, without a reload
	await expect(summary.getByText("Wolne miejsca: 4 / 5")).toBeVisible(
		LIVE_WAIT,
	);
	await expect(card.getByText("4 / 5 wolnych miejsc")).toBeVisible(LIVE_WAIT);
});

test("[F5] szybkie zapisy na dwa wydarzenia z listy oba się udają", async ({
	page,
}, testInfo) => {
	// Given two events on the list
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const tag = crypto.randomUUID().slice(0, 6);
	const first = await createTestEvent({
		title: `Pierwsze ${tag}`,
		maxSeats: 5,
	});
	const second = await createTestEvent({ title: `Drugie ${tag}`, maxSeats: 5 });
	await signInByEmail(page, email);
	await open(page, "/pl");
	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(tag);
	// Act only on the interactive list once the search results have settled.
	const list = page.locator("[data-live-list]");
	await expect(list).toHaveAttribute("aria-busy", "false");
	const card = (title: string) =>
		list.locator('[data-slot="card"]').filter({ hasText: title });
	await expect(card(first.title)).toBeVisible();
	await expect(card(second.title)).toBeVisible();
	// When the user taps both, the second tap while the first registration is still in flight
	await card(first.title)
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	await card(second.title)
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	// Then both registrations exist
	await expect(
		card(first.title).getByRole("button", { name: "Wypisz się" }),
	).toBeVisible();
	await expect(
		card(second.title).getByRole("button", { name: "Wypisz się" }),
	).toBeVisible();
});
