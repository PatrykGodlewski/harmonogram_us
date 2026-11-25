import { randomBytes } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

function warsawDateTime(days: number, time: string) {
	const date = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Europe/Warsaw",
	}).format(new Date(Date.now() + days * 86_400_000));
	return `${date}T${time}`;
}

async function panelAs(
	browser: Browser,
	email: string,
	role: "user" | "organizer" | "admin",
): Promise<Page> {
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role, password });
	const page = await (await browser.newContext()).newPage();
	await signInAsAdmin(page, email, password);
	return page;
}

test("[F2] organizator tworzy wydarzenie, dodaje współorganizatora, obcy nie ma dostępu @organizator", async ({
	browser,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const coEmail = `b-${base}`;
	const title = `Org ${randomBytes(4).toString("hex")}`;

	// Given organizer A in the panel: events yes, lookups no
	const a = await panelAs(browser, `a-${base}`, "organizer");
	await expect(a.getByRole("link", { name: "Typy wydarzeń" })).toHaveCount(0);
	await open(a, adminUrl("/pl/events"));

	// When A creates an event and adds plain user B as a co-organizer
	await a.getByRole("button", { name: "Dodaj", exact: true }).click();
	const dialog = a.getByRole("dialog");
	await dialog.getByLabel("Tytuł").fill(title);
	await dialog.getByLabel("Data").fill(warsawDateTime(7, "10:00"));
	await dialog.getByLabel("Maks. miejsc").fill("5");
	await dialog.getByRole("combobox", { name: "Typ" }).click();
	await a.getByRole("option").first().click();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
	await a.waitForURL(/\/events\/[^/]+$/);
	await a.waitForURL(/\/events\/[^/]+$/);
	const eventPath = new URL(a.url()).pathname;
	const organizers = a.getByRole("region", { name: "Organizatorzy" });
	await createTestUser(coEmail);
	await organizers.getByLabel("E-mail współorganizatora").fill(coEmail);
	await organizers.getByRole("button", { name: "Dodaj" }).click();
	await expect(organizers.getByText(coEmail)).toBeVisible();

	// Then B sees only that event and can edit it
	const b = await panelAs(browser, coEmail, "user");
	await open(b, adminUrl("/pl/events"));
	const row = b.getByRole("row").filter({ hasText: title });
	await expect(row).toHaveCount(1);
	await row.getByRole("button", { name: "Edytuj" }).click();
	await b.getByRole("dialog").getByLabel("Tytuł").fill(`${title} B`);
	await b.getByRole("dialog").getByRole("button", { name: "Zapisz" }).click();
	await expect(b.getByRole("link", { name: `${title} B` })).toBeVisible();

	// And a foreign organizer C gets no access
	const c = await panelAs(browser, `c-${base}`, "organizer");
	await open(c, adminUrl(eventPath));
	await expect(c.getByText("Brak dostępu do tego wydarzenia")).toBeVisible();
	await open(c, adminUrl("/pl/events"));
	await expect(c.getByText(title)).toHaveCount(0);

	// And a plain user D without events sees the no-access screen
	const d = await panelAs(browser, `d-${base}`, "user");
	await expect(d.getByRole("heading", { name: "Brak dostępu" })).toBeVisible();
});

test("[F2] administrator nadaje rolę organizatora @organizator", async ({
	browser,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const futureEmail = `przyszly-${base}`;
	const password = randomBytes(18).toString("base64url");
	await createTestUser(futureEmail, { password });

	// When an admin finds the user and makes them an organizer
	const admin = await panelAs(browser, `admin-${base}`, "admin");
	await open(admin, adminUrl("/pl/users"));
	await admin.getByLabel("Szukaj użytkownika").fill(futureEmail);
	const person = admin
		.getByRole("listitem")
		.filter({ hasText: futureEmail })
		.or(admin.getByRole("row").filter({ hasText: futureEmail }));
	await person.getByRole("combobox", { name: "Rola" }).click();
	await admin.getByRole("option", { name: "Organizator" }).click();
	await expect(admin.getByText("Zapisano rolę.")).toBeVisible();

	// Then that person can create events in the panel
	const organizer = await (await browser.newContext()).newPage();
	await signInAsAdmin(organizer, futureEmail, password);
	await open(organizer, adminUrl("/pl/events"));
	await expect(
		organizer.getByRole("button", { name: "Dodaj", exact: true }),
	).toBeVisible();
});
