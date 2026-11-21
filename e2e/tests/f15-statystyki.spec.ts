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
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	// Four places, five people (the fifth waits); it ended yesterday and three came.
	const event = await createTestEvent({
		organizerId: organizer.id,
		maxSeats: 4,
	});
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

test("[F15] administrator widzi wydarzenia i zapisy w czasie @organizator", async ({
	page,
}, testInfo) => {
	// Counts are global: one project only, so the phone run does not add the same data.
	test.skip(testInfo.project.name !== "komputer", "data check runs once");
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role: "admin", password });
	await signInAsAdmin(page, email, password);

	// The oldest month in the table (11 months ago): no other test puts data there.
	const oldestMonth = async () => {
		await open(page, adminUrl("/pl"));
		const row = page
			.getByRole("table", { name: "Aktywność w ostatnich 12 miesiącach" })
			.locator("tbody tr")
			.first();
		const [events, registrations] = await row.getByRole("cell").allInnerTexts();
		return { events: Number(events), registrations: Number(registrations) };
	};
	const before = await oldestMonth();

	// Two events and three registrations for one of them, moved into that month.
	const first = await createTestEvent({});
	const second = await createTestEvent({});
	for (const n of [1, 2, 3]) {
		const person = await createTestUser(`a${n}-${email}`);
		await registerForEvent(first.id, person.id, "pl");
	}
	const then = new Date();
	then.setUTCMonth(then.getUTCMonth() - 11, 15);
	then.setUTCHours(12, 0, 0, 0);
	await db
		.update(events)
		.set({ date: then, endsAt: then })
		.where(inArray(events.id, [first.id, second.id]));
	await db
		.update(eventRegistrations)
		.set({ createdAt: then })
		.where(eq(eventRegistrations.eventId, first.id));

	const after = await oldestMonth();
	expect(after.events - before.events).toBe(2);
	expect(after.registrations - before.registrations).toBe(3);
});

test("[F15] organizator nie widzi aktywności całej uczelni @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { role: "organizer", password });
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl("/pl"));
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(
		page.getByRole("table", { name: "Aktywność w ostatnich 12 miesiącach" }),
	).toHaveCount(0);
});
