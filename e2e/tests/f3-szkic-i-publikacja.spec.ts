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
	await page.getByRole("link", { name: title }).click();
	await page.waitForURL(/\/events\/[^/]+$/);
	const eventId = page.url().split("/").at(-1) ?? "";
	await expect(page.getByText("Szkic", { exact: true })).toBeVisible();

	// Then participants can't see it
	const visitor = await (await browser.newContext()).newPage();
	const hidden = await visitor.request.get(`/pl/events/${eventId}`);
	expect(hidden.status()).toBe(404);
	await open(visitor, `/pl?search=${encodeURIComponent(title)}`);
	await expect(visitor.getByText(title)).toHaveCount(0);

	// When publishing without a link it asks for one
	await page.getByRole("button", { name: "Opublikuj" }).click();
	await expect(
		page.getByText("Uzupełnij miejsce albo link online"),
	).toBeVisible();

	// When the link is added and the event published
	await open(page, adminUrl("/pl/events"));
	await page
		.getByRole("row")
		.filter({ hasText: title })
		.getByRole("button", { name: "Edytuj" })
		.click();
	await dialog.getByLabel("Link online").fill("https://meet.example.test/abc");
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await page.getByRole("link", { name: title }).click();
	await page.getByRole("button", { name: "Opublikuj" }).click();
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
