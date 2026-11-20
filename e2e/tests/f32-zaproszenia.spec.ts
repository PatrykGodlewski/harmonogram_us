import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

async function inviteLink(page: Page): Promise<string> {
	const field = page.getByLabel("Link zaproszenia", { exact: true });
	await expect(field).toHaveValue(/invite=/);
	return field.inputValue();
}

/** The path and query of the invite link (the browser's base URL is the site). */
const pathOf = (link: string) => {
	const url = new URL(link);
	return `${url.pathname}${url.search}`;
};

test("[F32] wydarzenie na zaproszenie: lista, link, zapis, zmiana linku @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });

	// The organiser makes the event invite-only and gets its link
	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("combobox", { name: "Kto widzi wydarzenie" }).click();
	await page.getByRole("option", { name: "Tylko z zaproszeniem" }).click();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	const firstLink = await inviteLink(page);

	// A guest: not on the list, no page without the link, registers with it
	const guestEmail = `guest-${base}`;
	await createTestUser(guestEmail);
	const guest = await (await browser.newContext()).newPage();
	await signInByEmail(guest, guestEmail);
	await open(guest, `/pl?search=${encodeURIComponent(event.title)}`);
	await expect(guest.getByText(event.title)).toHaveCount(0);
	await open(guest, `/pl/events/${event.id}`);
	await expect(
		guest.getByText("To wydarzenie nie istnieje lub zostało usunięte."),
	).toBeVisible();
	await open(guest, pathOf(firstLink));
	const summary = guest.locator("section").first();
	await summary.getByRole("button", { name: "Zarejestruj się" }).click();
	await expect(summary.getByText("Zarejestrowano")).toBeVisible();
	// Registered: the page opens without the link too
	await open(guest, `/pl/events/${event.id}`);
	await expect(
		guest.getByRole("heading", { name: event.title, level: 1 }),
	).toBeVisible();

	// A new link: the old one stops working for others
	await page.getByRole("button", { name: "Zmień link" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Zmień link" })
		.click();
	await expect(
		page.getByLabel("Link zaproszenia", { exact: true }),
	).not.toHaveValue(firstLink);
	const otherEmail = `other-${base}`;
	await createTestUser(otherEmail);
	const other = await (await browser.newContext()).newPage();
	await signInByEmail(other, otherEmail);
	await open(other, pathOf(firstLink));
	await expect(
		other.getByText("To wydarzenie nie istnieje lub zostało usunięte."),
	).toBeVisible();
	await open(other, pathOf(await inviteLink(page)));
	await expect(
		other.getByRole("heading", { name: event.title, level: 1 }),
	).toBeVisible();
});

test("[F32] zaproszenie e-mailem zawiera link @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		organizerId: organizer.id,
		visibility: "private",
	});
	const [first, second] = [`a-${base}`, `b-${base}`];

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Zaproś e-mailem" }).click();
	const dialog = page.getByRole("dialog");
	await dialog
		.getByLabel("Adresy e-mail")
		.fill(`${first}\n${second}, ${first}`);
	await dialog.getByRole("button", { name: "Wyślij zaproszenia" }).click();
	await expect(page.getByText("Wysłano zaproszenia: 2")).toBeVisible();

	for (const email of [first, second]) {
		const message = await latestMessageTo(email, { subject: "Zaproszenie" });
		expect(message.subject).toContain(event.title);
		expect(
			message.links.some((href) =>
				href.includes(`/events/${event.id}?invite=`),
			),
		).toBe(true);
	}
});
