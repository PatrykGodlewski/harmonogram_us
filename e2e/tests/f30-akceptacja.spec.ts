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

	const message = await latestMessageTo(email, {
		subject: "Czeka na akceptację",
	});
	expect(message.subject).toContain(event.title);

	await summary.getByRole("button", { name: "Wycofaj zgłoszenie" }).click();
	await expect(
		summary.getByRole("button", { name: "Poproś o zapis" }),
	).toBeVisible();
});
