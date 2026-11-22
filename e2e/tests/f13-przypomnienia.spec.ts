import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { queueDueReminderEmails } from "@repo/api/notifications/reminders";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F13] przypomnienie przychodzi o ustalonej godzinie", async () => {
	const email = uniqueEmail(test.info());
	const user = await createTestUser(email);
	const event = await createTestEvent({ startsInDays: 3 });
	await registerForEvent(event.id, user.id, "pl");

	// A controlled clock: 23 hours before the start (the default reminder is 24 hours before)
	const start = new Date(Date.now() + 3 * 86_400_000);
	await queueDueReminderEmails(new Date(start.getTime() - 23 * 3_600_000));

	const message = await latestMessageTo(email, { subject: "Przypomnienie" });
	expect(message.subject).toBe(`Przypomnienie: ${event.title}`);
	expect(
		message.links.some((href) => href.includes(`/pl/events/${event.id}`)),
	).toBe(true);
});

test("[F13] zmiana terminu daje e-mail ze starą i nową datą @organizator", async ({
	page,
}) => {
	const base = uniqueEmail(test.info());
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const guest = await createTestUser(`gosc-${base}`);
	const event = await createTestEvent({
		organizerId: organizer.id,
		startsInDays: 6,
	});
	await registerForEvent(event.id, guest.id, "pl");

	await signInAsAdmin(page, `org-${base}`, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	const dialog = page.getByRole("dialog");
	const newDate = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Europe/Warsaw",
	}).format(new Date(Date.now() + 9 * 86_400_000));
	await dialog.getByLabel("Data").fill(`${newDate}T16:30`);
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();

	const message = await latestMessageTo(`gosc-${base}`, { subject: "Zmiana" });
	expect(message.subject).toBe(`Zmiana: ${event.title}`);
	expect(message.text).toContain("16:30");
	expect(message.text).toMatch(/Termin: .+ → .+16:30/);
});
