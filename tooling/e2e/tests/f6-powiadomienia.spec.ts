import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F6] zapis wysyła potwierdzenie @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a signed-in user and an event with places
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({ maxSeats: 3 });
	await signInByEmail(page, email);
	// When they register
	await open(page, `/pl/events/${event.id}`);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	// Then a confirmation e-mail names the event and links to it
	const message = await latestMessageTo(email, { subject: "Zapisano" });
	expect(message.subject).toContain(event.title);
	expect(
		message.links.some((href) => href.endsWith(`/pl/events/${event.id}`)),
	).toBe(true);
});

test("[F6] zapis na listę rezerwową wysyła informację o liście", async ({
	page,
}, testInfo) => {
	// Given a full event
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, other.id, "pl");
	await signInByEmail(page, email);
	// When the user joins the waitlist
	await open(page, `/pl/events/${event.id}`);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Zapisz na listę rezerwową" })
		.click();
	// Then the e-mail says they are on the waitlist
	const message = await latestMessageTo(email, { subject: "Lista rezerwowa" });
	expect(message.subject).toContain(event.title);
});

test("[F6] awans z listy wysyła e-mail o awansie", async ({
	page,
}, testInfo) => {
	// Given A registered and B waitlisted for a 1-place event
	const base = uniqueEmail(testInfo);
	const a = `a-${base}`;
	const b = `b-${base}`;
	const event = await createTestEvent({ maxSeats: 1 });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	const userA = await createTestUser(a);
	const userB = await createTestUser(b);
	await registerForEvent(event.id, userA.id, "pl");
	await registerForEvent(event.id, userB.id, "pl");
	// When A withdraws
	await signInByEmail(page, a);
	await open(page, `/pl/events/${event.id}`);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Wypisz się" })
		.click();
	// Then B gets a "place freed up" e-mail with the event link
	const message = await latestMessageTo(b, { subject: "Miejsce się zwolniło" });
	expect(message.subject).toContain(event.title);
	expect(
		message.links.some((href) => href.endsWith(`/pl/events/${event.id}`)),
	).toBe(true);
});

test("[F11] e-mail potwierdzenia linkuje do biletu @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a signed-in user who registers for an event
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({ maxSeats: 3 });
	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	// When they follow the ticket link from the confirmation e-mail
	const message = await latestMessageTo(email, { subject: "Zapisano" });
	const ticketLink = message.links.find((href) =>
		href.includes("/pl/tickets/"),
	);
	expect(ticketLink).toBeDefined();
	await open(page, ticketLink ?? "");
	// Then the ticket with its QR code opens
	await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
	await expect(page.getByRole("img", { name: "Kod QR biletu" })).toBeVisible();
});
