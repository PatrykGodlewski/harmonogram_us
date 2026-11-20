import { expect, test } from "@playwright/test";
import { queueDueReminderEmails } from "@repo/api/notifications/reminders";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";

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
