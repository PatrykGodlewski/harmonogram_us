import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

function warsawDateTime(days: number, time: string) {
	const date = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Europe/Warsaw",
	}).format(new Date(Date.now() + days * 86_400_000));
	return `${date}T${time}`;
}

test("[F3] szkic nie jest publiczny, publikacja go pokazuje @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role: "organizer", password });
	const title = `Szkic ${randomBytes(4).toString("hex")}`;

	// When an organizer creates an online event without a link
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl("/pl/events"));
	await page.getByRole("button", { name: "Dodaj", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill(title);
	await dialog.getByLabel("Data").fill(warsawDateTime(5, "18:00"));
	await dialog.getByRole("combobox", { name: "Forma" }).click();
	await page.getByRole("option", { name: "Online" }).click();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await page.waitForURL(/\/events\/[^/]+$/);
	await page.waitForURL(/\/events\/[^/]+$/);
	const eventId = page.url().split("/").at(-1) ?? "";
	await expect(page.getByText("Szkic", { exact: true })).toBeVisible();

	// Then participants can't see it
	const visitor = await (await browser.newContext()).newPage();
	const hidden = await visitor.request.get(`/pl/events/${eventId}`);
	expect(hidden.status()).toBe(404);
	await open(visitor, `/pl?search=${encodeURIComponent(title)}`);
	await expect(visitor.getByText(title)).toHaveCount(0);

	// The checklist says what's missing, and the fix is right there
	const checklist = page.getByRole("region", { name: "Przed publikacją" });
	await expect(checklist.getByText("Gotowe w 1 z 2")).toBeVisible();
	const linkRow = checklist
		.getByRole("listitem")
		.filter({ hasText: "Link online" });
	await expect(linkRow.getByText("Brakuje")).toBeVisible();
	await expect(
		checklist.getByRole("button", { name: "Opublikuj" }),
	).toBeDisabled();
	await linkRow.getByLabel("Link online").fill("meet.example.test/abc");
	await linkRow.getByRole("button", { name: "Zapisz" }).click();
	await expect(
		linkRow.getByText("Link musi zaczynać się od https://"),
	).toBeVisible();
	await linkRow.getByLabel("Link online").fill("https://meet.example.test/abc");
	await linkRow.getByRole("button", { name: "Zapisz" }).click();
	await expect(linkRow.getByText("Gotowe")).toBeVisible();
	await expect(checklist.getByText("Gotowe w 2 z 2")).toBeVisible();
	await checklist.getByRole("button", { name: "Opublikuj" }).click();
	await expect(page.getByText("Szkic", { exact: true })).toHaveCount(0);

	// Then participants find it, marked as online
	await open(visitor, `/pl?search=${encodeURIComponent(title)}`);
	const card = visitor.locator('[data-slot="card"]').filter({ hasText: title });
	await expect(card).toBeVisible();
	await expect(card.getByText("Online")).toBeVisible();
});

test("[F3] link online widzą tylko zapisani @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({
		attendanceMode: "online",
		onlineUrl: "https://meet.example.test/tylko-dla-zapisanych",
	});

	await signInByEmail(page, email);
	await open(page, `/pl/events/${event.id}`);
	const join = page.getByRole("link", { name: "Dołącz online" });
	await expect(join).toHaveCount(0);
	await page
		.locator("section")
		.first()
		.getByRole("button", { name: "Zarejestruj się" })
		.click();
	await expect(join).toHaveAttribute(
		"href",
		"https://meet.example.test/tylko-dla-zapisanych",
	);
});

test("[F3] sala wpisana ręcznie wystarcza do publikacji @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role: "organizer", password });
	const title = `Sala ${randomBytes(4).toString("hex")}`;

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl("/pl/events"));
	await page.getByRole("button", { name: "Dodaj", exact: true }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill(title);
	await dialog.getByLabel("Data").fill(warsawDateTime(6, "12:00"));
	await dialog.getByLabel("Sala / pokój").fill("B105");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await page.waitForURL(/\/events\/[^/]+$/);
	await page.getByRole("button", { name: "Opublikuj" }).click();
	await expect(page.getByText("Szkic", { exact: true })).toHaveCount(0);
	const eventId = page.url().split("/").at(-1) ?? "";

	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${eventId}`);
	await expect(visitor.getByText("sala B105")).toBeVisible();
});

test("[F3] brakującą salę wpisuje się na liście kontrolnej @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		organizerId: organizer.id,
		status: "draft",
	});

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const checklist = page.getByRole("region", { name: "Przed publikacją" });
	const placeRow = checklist
		.getByRole("listitem")
		.filter({ hasText: "Miejsce lub sala" });
	await expect(placeRow.getByText("Brakuje")).toBeVisible();
	await placeRow.getByLabel("Sala / pokój").fill("B105");
	await placeRow.getByRole("button", { name: "Zapisz" }).click();
	await expect(placeRow.getByText("Gotowe")).toBeVisible();
	await expect(placeRow.getByText("sala B105")).toBeVisible();

	// Switching to online in the checklist asks for a link instead
	await checklist.getByRole("combobox", { name: "Forma" }).click();
	await page.getByRole("option", { name: "Online" }).click();
	await expect(
		checklist
			.getByRole("listitem")
			.filter({ hasText: "Link online" })
			.getByText("Brakuje"),
	).toBeVisible();
	await checklist.getByRole("combobox", { name: "Forma" }).click();
	await page.getByRole("option", { name: "Na miejscu" }).click();

	await checklist.getByRole("button", { name: "Opublikuj" }).click();
	await expect(page.getByText("Szkic", { exact: true })).toHaveCount(0);
});
