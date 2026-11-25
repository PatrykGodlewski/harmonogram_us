import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { createEventQuestion } from "@repo/db/queries/event-questions";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authUsers } from "@repo/db/schema/better-auth";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { and, eq } from "drizzle-orm";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

/** From the event page's one register button to the sign-in page, choosing no account. */
async function openGuestForm(page: Page, eventId: string) {
	await open(page, `/pl/events/${eventId}`);
	await page
		.locator("section")
		.first()
		.getByRole("link", { name: "Zarejestruj się" })
		.click();
	await expect(page).toHaveURL(/\/pl\/login/);
	await page
		.getByRole("radiogroup", { name: "Jak chcesz się zapisać?" })
		.getByRole("radio", { name: "Bez konta — wyślij mi link" })
		.check();
	return page.getByRole("form", { name: "Zapis bez konta" });
}

/** Fills the guest form on the event's sign-in page; returns the confirmation link from Mailpit. */
async function registerAsGuest(
	page: Page,
	eventId: string,
	email: string,
	answer?: { label: string; value: string },
): Promise<string> {
	const form = await openGuestForm(page, eventId);
	await form.getByLabel("Imię i nazwisko").fill("Gość Testowy");
	await form.getByLabel("E-mail").fill(email);
	if (answer) await form.getByLabel(answer.label).fill(answer.value);
	await form.getByRole("button", { name: "Wyślij link potwierdzenia" }).click();
	await expect(page.getByRole("status")).toContainText("Sprawdź skrzynkę");
	const message = await latestMessageTo(email, { subject: "Potwierdź zapis" });
	const link = message.links.find((href) => href.includes("/guest/confirm"));
	expect(link, "confirmation link in the e-mail").toBeTruthy();
	return link ?? "";
}

test("[F17] gość zapisuje się i potwierdza linkiem @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const event = await createTestEvent({});
	await createEventQuestion({
		eventId: event.id,
		label: "Kierunek studiów",
		kind: "text",
		required: true,
	});

	const link = await registerAsGuest(page, event.id, email, {
		label: "Kierunek studiów",
		value: "Informatyka",
	});

	// A mail scanner fetching the link changes nothing.
	await page.request.get(link);
	await open(page, link);
	await page.getByRole("button", { name: "Potwierdź zapis" }).click();

	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}`));
	await expect(
		page.locator("section").first().getByText("Zarejestrowano"),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Wyloguj" })).toBeVisible();
});

test("[F17] link potwierdzenia działa raz @uczestnik", async ({
	page,
	browser,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const event = await createTestEvent({});
	const link = await registerAsGuest(page, event.id, email);
	await open(page, link);
	await page.getByRole("button", { name: "Potwierdź zapis" }).click();
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}`));

	const other = await (await browser.newContext({ locale: "pl-PL" })).newPage();
	await open(other, link);
	await other.getByRole("button", { name: "Potwierdź zapis" }).click();
	await expect(other.getByRole("alert")).toContainText(
		"Link wygasł albo został już użyty",
	);
});

test("[F17] na stronie wydarzenia jest jeden przycisk, a logowanie proponuje konto @uczestnik", async ({
	page,
}) => {
	const event = await createTestEvent({});
	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await expect(
		summary.getByRole("link", { name: "Zarejestruj się" }),
	).toBeVisible();
	await expect(summary.getByText("Zapisz się bez konta")).toHaveCount(0);
	await summary.getByRole("link", { name: "Zarejestruj się" }).click();
	// The sign-in page names the event and starts with an account
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		event.title,
	);
	await expect(
		page.getByRole("radio", { name: "Mam konto lub je założę" }),
	).toBeChecked();
	await expect(
		page.getByRole("button", { name: /link logowania/ }),
	).toBeVisible();
	await expect(page.getByRole("form", { name: "Zapis bez konta" })).toHaveCount(
		0,
	);
});

test("[F17] zapis bez konta działa też na wydarzeniu tylko dla zalogowanych @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const signedInOnly = await createTestEvent({ visibility: "authenticated" });
	// The event page sends signed-out visitors to the same sign-in page, with the choice
	await open(page, `/pl/events/${signedInOnly.id}`);
	await expect(page).toHaveURL(/\/pl\/login/);
	await page
		.getByRole("radiogroup", { name: "Jak chcesz się zapisać?" })
		.getByRole("radio", { name: "Bez konta — wyślij mi link" })
		.check();
	const form = page.getByRole("form", { name: "Zapis bez konta" });
	await form.getByLabel("Imię i nazwisko").fill("Gość Testowy");
	await form.getByLabel("E-mail").fill(email);
	await form.getByRole("button", { name: "Wyślij link potwierdzenia" }).click();
	const message = await latestMessageTo(email, { subject: "Potwierdź zapis" });
	const link = message.links.find((href) => href.includes("/guest/confirm"));
	await open(page, link ?? "");
	await page.getByRole("button", { name: "Potwierdź zapis" }).click();
	await expect(page).toHaveURL(new RegExp(`/pl/events/${signedInOnly.id}`));
	await expect(
		page.locator("section").first().getByText("Zarejestrowano"),
	).toBeVisible();
});

test("[F17] gość rezygnuje przez link z e-maila @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const waiting = `w-${email}`;
	// One place: the guest takes it, a signed-up person waits for it.
	const event = await createTestEvent({ maxSeats: 1 });
	const link = await registerAsGuest(page, event.id, email);
	await open(page, link);
	await page.getByRole("button", { name: "Potwierdź zapis" }).click();
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}`));
	const waiter = await createTestUser(waiting);
	await registerForEvent(event.id, waiter.id, "pl");

	const confirmed = await latestMessageTo(email, { subject: "Zapisano" });
	const withdraw = confirmed.links.find((href) => href.includes("/withdraw"));
	expect(withdraw, "withdraw link in the confirmation e-mail").toBeTruthy();

	// A mail scanner fetching the link changes nothing.
	await page.request.get(withdraw ?? "");
	await expect(await stateOf(event.id, email)).toBe("registered");

	await open(page, withdraw ?? "");
	await page.getByRole("button", { name: "Zrezygnuj z zapisu" }).click();
	await expect(page.getByRole("status")).toContainText("Zrezygnowano");
	expect(await stateOf(event.id, email)).toBeNull();
	// The place went to the person waiting.
	await latestMessageTo(waiting, { subject: "Miejsce się zwolniło" });
});

test("[F17] zmieniony link rezygnacji nie działa @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const event = await createTestEvent({});
	const link = await registerAsGuest(page, event.id, email);
	await open(page, link);
	await page.getByRole("button", { name: "Potwierdź zapis" }).click();
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}`));
	const confirmed = await latestMessageTo(email, { subject: "Zapisano" });
	const withdraw = new URL(
		confirmed.links.find((href) => href.includes("/withdraw")) ?? "",
	);
	withdraw.searchParams.set("token", "x".repeat(43));

	await open(page, withdraw.toString());
	await page.getByRole("button", { name: "Zrezygnuj z zapisu" }).click();
	await expect(page.getByRole("alert")).toContainText(
		"Link jest nieprawidłowy",
	);
	expect(await stateOf(event.id, email)).toBe("registered");
});

async function stateOf(eventId: string, email: string) {
	const [row] = await db
		.select({ state: eventRegistrations.state })
		.from(eventRegistrations)
		.innerJoin(authUsers, eq(authUsers.id, eventRegistrations.userId))
		.where(
			and(eq(eventRegistrations.eventId, eventId), eq(authUsers.email, email)),
		);
	return row?.state ?? null;
}

test("[F17] po odmowie gość poprawia adres i wysyła ponownie @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const event = await createTestEvent({});
	const form = await openGuestForm(page, event.id);
	await form.getByLabel("Imię i nazwisko").fill("Gość Testowy");
	// A throwaway address is refused by the server…
	await form.getByLabel("E-mail").fill("gosc@mailinator.com");
	await form.getByRole("button", { name: "Wyślij link potwierdzenia" }).click();
	await expect(form.getByRole("alert")).toBeVisible();
	// …and after correcting it the form works again (a fresh CAPTCHA token).
	await form.getByLabel("E-mail").fill(email);
	await form.getByRole("button", { name: "Wyślij link potwierdzenia" }).click();
	await expect(page.getByRole("status")).toContainText("Sprawdź skrzynkę");
});

test("[F17] z linku zaproszenia: logowanie hasłem wraca na wydarzenie @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = `Haslo-${crypto.randomUUID()}`;
	await createTestUser(email, { password });
	const event = await createTestEvent({ visibility: "private" });
	const { events } = await import("@repo/db/schema/events");
	const [row] = await db
		.select({ invite: events.inviteToken })
		.from(events)
		.where(eq(events.id, event.id));
	const invite = row?.invite ?? "";

	await open(page, `/pl/events/${event.id}?invite=${invite}`);
	await page
		.locator("section")
		.first()
		.getByRole("link", { name: "Zarejestruj się" })
		.click();
	// The default choice: sign in with an account (here: a password)
	await page.getByRole("button", { name: "Pokaż logowanie hasłem" }).click();
	await page.getByRole("textbox", { name: "E-mail" }).fill(email);
	await page.getByLabel("Hasło", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Zaloguj się hasłem" }).click();
	// Back on the invite-only event, signed in, one click from registering
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}\\?invite=`));
	await expect(
		page
			.locator("section")
			.first()
			.getByRole("button", { name: "Zarejestruj się" }),
	).toBeVisible();
});
