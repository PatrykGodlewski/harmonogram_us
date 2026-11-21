import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { events } from "@repo/db/schema/events";
import { and, eq, inArray } from "drizzle-orm";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F15] organizator widzi zapisanych, obecnych i nieobecnych @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, { role: "organizer", password });
	// Four places, five people (the fifth waits); it ended yesterday and three came.
	const event = await createTestEvent({ organizerId: organizer.id, maxSeats: 4 });
	const people = await Promise.all(
		[1, 2, 3, 4, 5].map((n) => createTestUser(`p${n}-${email}`)),
	);
	for (const person of people) {
		await registerForEvent(event.id, person.id, "pl");
	}
	const yesterday = new Date(Date.now() - 86_400_000);
	await db
		.update(events)
		.set({ date: yesterday, endsAt: yesterday })
		.where(eq(events.id, event.id));
	await db
		.update(eventRegistrations)
		.set({ checkedInAt: new Date() })
		.where(
			and(
				eq(eventRegistrations.eventId, event.id),
				inArray(
					eventRegistrations.userId,
					people.slice(0, 3).map((person) => person.id),
				),
			),
		);

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));

	const stats = page.getByRole("region", { name: "Statystyki" });
	await expect(stats.getByRole("definition").nth(0)).toHaveText("4");
	await expect(stats).toContainText("Zapisani4");
	await expect(stats).toContainText("Obecni3");
	await expect(stats).toContainText("Nieobecni1");
	await expect(stats).toContainText("25% nieobecnych");
	await expect(stats).toContainText("Rezerwowi1");
});
