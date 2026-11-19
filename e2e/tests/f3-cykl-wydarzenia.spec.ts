import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/** Wall-clock parts in Warsaw, `days` from now, for datetime-local/date/time inputs. */
function warsawInput(days: number, time: string) {
	const date = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Europe/Warsaw",
	}).format(new Date(Date.now() + days * 86_400_000));
	return { date, dateTime: `${date}T${time}` };
}

async function createEventInAdmin(page: Page, title: string) {
	await open(page, adminUrl("/pl/events"));
	await page.getByRole("button", { name: "Dodaj", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill(title);
	await dialog.getByLabel("Data").fill(warsawInput(7, "10:00").dateTime);
	await dialog.getByLabel("Maks. miejsc").fill("2");
	await dialog.getByRole("combobox", { name: "Typ" }).click();
	await page.getByRole("option", { name: "Seminarium" }).click();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole("link", { name: title }).click();
	await page.waitForURL(/\/events\/[^/]+$/);
	return page.url().split("/").at(-1) ?? "";
}

async function addAgendaItemInAdmin(page: Page, title: string) {
	await page.getByRole("button", { name: "Dodaj punkt" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill(title);
	await dialog.getByLabel("Data").fill(warsawInput(7, "10:00").date);
	await dialog.getByLabel("Godzina rozpoczęcia").fill("10:00");
	await dialog.getByLabel("Godzina zakończenia").fill("11:30");
	await dialog.getByLabel("Limit miejsc").fill("1");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await expect(page.getByText(title)).toBeVisible();
}

test("[F3] pełny cykl: admin tworzy, uczestnik się zapisuje, wydarzenie się kończy albo zostaje usunięte", async ({
	browser,
	page,
}, testInfo) => {
	// Given an admin and a participant
	const adminEmail = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(adminEmail, { admin: true, password });
	const participantEmail = `uczestnik-${adminEmail}`;
	const participant = await createTestUser(participantEmail);
	// (the fixture also makes sure the "Seminarium" type exists)
	const toDelete = await createTestEvent({ startsInDays: 12 });
	await registerForEvent(toDelete.id, participant.id, "pl");

	// When the admin creates an event with an agenda item in the panel
	const title = `Cykl ${randomBytes(4).toString("hex")}`;
	await signInAsAdmin(page, adminEmail, password);
	const eventId = await createEventInAdmin(page, title);
	await addAgendaItemInAdmin(page, "Warsztat cyklu");

	// Then the participant finds it and registers for the agenda item (and so the event)
	const participantContext = await browser.newContext();
	const user = await participantContext.newPage();
	await signInByEmail(user, participantEmail);
	await open(user, `/pl/events/${eventId}`);
	await expect(user.getByRole("heading", { name: title })).toBeVisible();
	const item = user.getByRole("listitem").filter({ hasText: "Warsztat cyklu" });
	await item.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(item.getByText("Zarejestrowano ✓")).toBeVisible();
	await expect(
		item.getByRole("paragraph").filter({ hasText: "Brak miejsc" }),
	).toBeVisible();
	await expect(
		user.locator("section").first().getByText("Wolne miejsca: 1 / 2"),
	).toBeVisible();

	// And the admin sees the registrant
	await page.reload();
	await expect(page.getByText(participantEmail)).toBeVisible();

	// When the event ends
	const ended = new Date(Date.now() - 2 * 3_600_000);
	await db
		.update(events)
		.set({ date: new Date(ended.getTime() - 3_600_000), endsAt: ended })
		.where(eq(events.id, eventId));

	// Then registration is closed and the event is in the participant's past events
	await open(user, `/pl/events/${eventId}`);
	await expect(user.getByText("Zapisy zamknięte").first()).toBeVisible();
	await open(user, "/pl/account");
	await expect(
		user.getByRole("region", { name: "Minione" }).getByText(title),
	).toBeVisible();

	// When the admin deletes another event the participant registered for
	await open(page, adminUrl("/pl/events"));
	page.once("dialog", (dialog) => void dialog.accept());
	await page
		.getByRole("row")
		.filter({ hasText: toDelete.title })
		.getByRole("button", { name: "Usuń" })
		.click();
	await expect(
		page.getByRole("row").filter({ hasText: toDelete.title }),
	).toHaveCount(0);

	// Then it disappears from the participant's account and its page says it's gone
	await open(user, "/pl/account");
	await expect(user.getByText(toDelete.title)).toHaveCount(0);
	await open(user, `/pl/events/${toDelete.id}`);
	await expect(
		user.getByText("To wydarzenie nie istnieje lub zostało usunięte."),
	).toBeVisible();
	await participantContext.close();
});
