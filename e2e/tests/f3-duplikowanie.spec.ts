import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

function warsawDate(days: number) {
	return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(
		new Date(Date.now() + days * 86_400_000),
	);
}

test("[F3] duplikat ma te same dane i nowy termin @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const source = await createTestEvent({
		title: `Duplikat ${randomBytes(4).toString("hex")}`,
		organizerId: organizer.id,
		agenda: [{ title: "Otwarcie" }, { title: "Dyskusja" }],
	});

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${source.id}`));
	await page.getByRole("button", { name: "Duplikuj" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Nowy termin").fill(`${warsawDate(14)}T12:00`);
	await dialog.getByRole("button", { name: "Duplikuj" }).click();

	// Then the copy opens: a draft with the same title, the new date, the agenda and nobody registered
	await page.waitForURL((url) => !url.pathname.endsWith(source.id));
	await expect(
		page.getByRole("heading", { name: source.title, level: 1 }),
	).toBeVisible();
	await expect(page.getByText("Szkic", { exact: true })).toBeVisible();
	const [year, month, day] = warsawDate(14).split("-").map(Number);
	const expected = new Intl.DateTimeFormat("pl-PL", {
		timeZone: "Europe/Warsaw",
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12)));
	await expect(page.getByText(expected).first()).toBeVisible();
	await expect(page.getByText("12:00").first()).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Program" }).getByText("Otwarcie"),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Program" }).getByText("Dyskusja"),
	).toBeVisible();
	await expect(page.getByText("Zapisani (0)")).toBeVisible();
});
