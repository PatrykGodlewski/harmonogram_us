import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { LIVE_WAIT } from "../fixtures/live";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F3] [F6] odwołanie zamyka zapisy, wysyła e-maile i zmienia stronę na żywo @organizator", async ({
	browser,
	page,
}, testInfo) => {
	// Waits for a page refresh (up to 20 s) on top of the usual steps.
	test.slow();
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		maxSeats: 1,
		organizerId: organizer.id,
	});
	const x = await createTestUser(`x-${base}`);
	const y = await createTestUser(`y-${base}`);
	await registerForEvent(event.id, x.id, "pl");
	await registerForEvent(event.id, y.id, "pl");

	// Given participant Z has the event page open
	const zEmail = `z-${base}`;
	await createTestUser(zEmail);
	const z = await (await browser.newContext()).newPage();
	await signInByEmail(z, zEmail);
	await open(z, `/pl/events/${event.id}`);
	await expect(
		z
			.locator("section")
			.first()
			.getByRole("button", {
				name: /Zapisz na listę rezerwową|Zarejestruj się/,
			}),
	).toBeVisible();

	// When the organizer cancels the event
	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Odwołaj wydarzenie" }).click();
	await page
		.getByRole("alertdialog")
		.getByRole("button", { name: "Odwołaj wydarzenie" })
		.click();
	await expect(
		page.getByText("Odwołane", { exact: true }).first(),
	).toBeVisible();

	// Then Z's page shows it without a reload, and registration is gone
	await expect(z.getByText("Wydarzenie odwołane")).toBeVisible(LIVE_WAIT);
	await expect(
		z
			.locator("section")
			.first()
			.getByRole("button", { name: /Zarejestruj się|listę rezerwową/ }),
	).toHaveCount(0);

	// And X and Y get the cancellation e-mail
	for (const email of [`x-${base}`, `y-${base}`]) {
		const message = await latestMessageTo(email, { subject: "Odwołano" });
		expect(message.subject).toContain(event.title);
		expect(
			message.links.some((href) => href.includes(`/pl/events/${event.id}`)),
		).toBe(true);
	}

	// And the list marks it, and X's account offers no withdrawal
	await open(z, `/pl?search=${encodeURIComponent(event.title)}`);
	await expect(
		z
			.locator('[data-slot="card"]')
			.filter({ hasText: event.title })
			.getByText("Odwołane"),
	).toBeVisible();
	const xPage = await (await browser.newContext()).newPage();
	await signInByEmail(xPage, `x-${base}`);
	await open(xPage, "/pl/account");
	const entry = xPage
		.getByRole("region", { name: "Nadchodzące" })
		.getByRole("listitem")
		.filter({ hasText: event.title });
	await expect(entry.getByText("Odwołane")).toBeVisible();
	await expect(entry.getByRole("button", { name: "Wypisz się" })).toHaveCount(
		0,
	);
});
