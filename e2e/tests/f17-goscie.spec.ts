import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { createEventQuestion } from "@repo/db/queries/event-questions";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authUsers } from "@repo/db/schema/better-auth";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { and, eq } from "drizzle-orm";
import { waitForCaptcha } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

/** Fills the guest form on the event page and returns the confirmation link from Mailpit. */
async function registerAsGuest(
	page: Page,
	eventId: string,
	email: string,
	answer?: { label: string; value: string },
): Promise<string> {
	await open(page, `/pl/events/${eventId}`);
	await page.getByRole("button", { name: "Zapisz się bez konta" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Imię i nazwisko").fill("Gość Testowy");
	await dialog.getByLabel("E-mail").fill(email);
	if (answer) await dialog.getByLabel(answer.label).fill(answer.value);
	await waitForCaptcha(page);
	await dialog
		.getByRole("button", { name: "Wyślij link potwierdzenia" })
		.click();
	await expect(dialog).toContainText("Sprawdź skrzynkę");
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

test("[F17] wydarzenie tylko dla zalogowanych nie ma zapisu gościa @uczestnik", async ({
	page,
}) => {
	const publicEvent = await createTestEvent({});
	await open(page, `/pl/events/${publicEvent.id}`);
	await expect(
		page.getByRole("button", { name: "Zapisz się bez konta" }),
	).toBeVisible();

	const signedInOnly = await createTestEvent({ visibility: "authenticated" });
	await open(page, `/pl/events/${signedInOnly.id}`);
	// The page itself sends anonymous visitors to sign in.
	await expect(page).toHaveURL(/\/pl\/login/);
	await expect(
		page.getByRole("button", { name: "Zapisz się bez konta" }),
	).toHaveCount(0);
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
