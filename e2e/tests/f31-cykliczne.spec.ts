import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { agendaItems } from "@repo/db/schema/agenda";
import { events } from "@repo/db/schema/events";
import { asc, eq, inArray } from "drizzle-orm";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

function warsawDate(days: number) {
	return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(
		new Date(Date.now() + days * 86_400_000),
	);
}

const warsawTime = (date: Date) =>
	new Intl.DateTimeFormat("pl-PL", {
		timeZone: "Europe/Warsaw",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);

test("[F31] co tydzień, 4 razy daje cztery szkice @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const title = `Cykl ${randomBytes(4).toString("hex")}`;
	const source = await createTestEvent({
		title,
		organizerId: organizer.id,
		agenda: [{ title: "Otwarcie" }],
	});

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${source.id}`));
	await page.getByRole("button", { name: "Duplikuj" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Nowy termin").fill(`${warsawDate(7)}T18:00`);
	await dialog.getByRole("combobox", { name: "Powtarzaj" }).click();
	await page.getByRole("option", { name: "Co tydzień" }).click();
	// Typing into the field replaces the number (no jump to the maximum)
	const count = dialog.getByLabel("Ile razy");
	await count.press("Backspace");
	await count.pressSequentially("6");
	await expect(
		dialog.getByRole("button", { name: "Utwórz kopie (6)" }),
	).toBeVisible();
	await count.fill("4");
	await dialog.getByLabel("Program").uncheck();
	await dialog.getByRole("button", { name: "Utwórz kopie (4)" }).click();
	await expect(page.getByText("Utworzono szkiców: 4")).toBeVisible();

	const copies = await db
		.select({ id: events.id, date: events.date, status: events.status })
		.from(events)
		.where(eq(events.title, title))
		.orderBy(asc(events.date));
	const drafts = copies.filter((copy) => copy.id !== source.id);
	expect(drafts).toHaveLength(4);
	for (const [index, draft] of drafts.entries()) {
		expect(draft.status).toBe("draft");
		expect(warsawTime(draft.date)).toBe("18:00");
		expect(
			new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(
				draft.date,
			),
		).toBe(warsawDate(7 + index * 7));
	}
	const copiedItems = await db
		.select({ id: agendaItems.id })
		.from(agendaItems)
		.where(
			inArray(
				agendaItems.eventId,
				drafts.map((draft) => draft.id),
			),
		);
	expect(copiedItems).toHaveLength(0);
});
