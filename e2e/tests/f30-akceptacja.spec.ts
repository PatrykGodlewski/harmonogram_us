import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F30] organizator włącza akceptację zapisów @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Zapisy wymagają akceptacji").check();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();

	await expect(page.getByText("Zapisy z akceptacją")).toBeVisible();
	const [row] = await db
		.select({ requiresApproval: events.requiresApproval })
		.from(events)
		.where(eq(events.id, event.id));
	expect(row?.requiresApproval).toBe(true);
});

test("[F30] zapis na wydarzenie z akceptacją czeka @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	const event = await createTestEvent({ requiresApproval: true });
	await signInByEmail(page, email);

	await open(page, `/pl/events/${event.id}`);
	const summary = page.locator("section").first();
	await summary.getByRole("button", { name: "Poproś o zapis" }).click();
	await expect(summary.getByText("Czeka na akceptację")).toBeVisible();
	await expect(page.getByText("Zgłoszenie wysłane")).toBeVisible();

	const message = await latestMessageTo(email, {
		subject: "Czeka na akceptację",
	});
	expect(message.subject).toContain(event.title);

	await summary.getByRole("button", { name: "Wycofaj zgłoszenie" }).click();
	await expect(
		summary.getByRole("button", { name: "Poproś o zapis" }),
	).toBeVisible();
});

test("[F30] organizator akceptuje i odrzuca, uczestnicy dostają e-mail @organizator", async ({
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
		requiresApproval: true,
	});
	const people = [`a-${base}`, `b-${base}`, `c-${base}`];
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	for (const email of people) {
		const user = await createTestUser(email);
		await registerForEvent(event.id, user.id, "pl");
	}
	const [approved, rejected, bulk] = people as [string, string, string];

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await expect(page.getByText("Czekają na akceptację: 3")).toBeVisible();

	const row = (email: string) =>
		page.getByRole("listitem").filter({ hasText: email });
	await row(approved).getByRole("button", { name: "Akceptuj" }).click();
	await expect(row(approved).getByText("Czeka")).toBeHidden();
	await row(rejected).getByRole("button", { name: "Odrzuć" }).click();
	await expect(row(rejected).getByText("Odrzucone")).toBeVisible();

	await page.getByRole("checkbox", { name: `Zaznacz ${bulk}` }).check();
	await page
		.getByRole("toolbar")
		.getByRole("button", { name: "Akceptuj" })
		.click();
	await expect(page.getByText(/Czekają na akceptację/)).toBeHidden();

	expect(
		(await latestMessageTo(approved, { subject: "Zapisano" })).subject,
	).toContain(event.title);
	expect(
		(await latestMessageTo(rejected, { subject: "Zgłoszenie odrzucone" }))
			.subject,
	).toContain(event.title);
	expect(
		(await latestMessageTo(bulk, { subject: "Zapisano" })).subject,
	).toContain(event.title);
});

test("[F30] odrzucony widzi decyzję i nie może się wypisać @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({ requiresApproval: true });
	const { registerForEvent } = await import(
		"@repo/db/queries/event-registrations"
	);
	await registerForEvent(event.id, user.id, "pl");
	const { eventRegistrations } = await import(
		"@repo/db/schema/event-registrations"
	);
	await db
		.update(eventRegistrations)
		.set({ state: "rejected" })
		.where(eq(eventRegistrations.userId, user.id));
	await signInByEmail(page, email);

	await open(page, "/pl/my-events");
	const row = page.getByRole("listitem").filter({ hasText: event.title });
	await expect(row.getByText("Odrzucone")).toBeVisible();
	await expect(row.getByRole("button", { name: "Wypisz się" })).toBeHidden();

	await open(page, `/pl/events/${event.id}`);
	await expect(page.getByText("Zgłoszenie odrzucone")).toBeVisible();
	await expect(page.getByRole("link", { name: "Zapisz grupę" })).toBeHidden();
});
