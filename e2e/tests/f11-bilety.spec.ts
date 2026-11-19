import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { and, eq } from "drizzle-orm";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

async function registrationOf(eventId: string, userId: string) {
	const [row] = await db
		.select({
			id: eventRegistrations.id,
			ticketCode: eventRegistrations.ticketCode,
		})
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	if (!row) {
		throw new Error("registration not found");
	}
	return row;
}

test("[F11] bilet z kodem QR na koncie @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a user registered for an event
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({ startsInDays: 5 });
	await registerForEvent(event.id, user.id, "pl");
	const registration = await registrationOf(event.id, user.id);

	// When they open the ticket from their account
	await signInByEmail(page, email);
	await open(page, "/pl/account");
	await page
		.getByRole("listitem")
		.filter({ hasText: event.title })
		.getByRole("link", { name: "Bilet" })
		.click();

	// Then the ticket shows the event, the holder and a QR code with the ticket code
	await expect(page.getByRole("heading", { name: event.title })).toBeVisible();
	await expect(page.getByText(email)).toBeVisible();
	const qr = page.getByRole("img", { name: "Kod QR biletu" });
	await expect(qr).toBeVisible();
	const png = PNG.sync.read(await qr.screenshot());
	const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
	expect(decoded?.data).toBe(`harmonogram-ticket:${registration.ticketCode}`);
});

test("[F11] cudzy bilet i bilet z listy rezerwowej @uczestnik", async ({
	page,
}, testInfo) => {
	// Given a user on the waitlist of a full event, and someone else's registration
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const other = await createTestUser(`other-${email}`);
	const event = await createTestEvent({ maxSeats: 1 });
	await registerForEvent(event.id, other.id, "pl");
	await registerForEvent(event.id, user.id, "pl");
	const mine = await registrationOf(event.id, user.id);
	const theirs = await registrationOf(event.id, other.id);
	await signInByEmail(page, email);

	// When they open someone else's ticket, it isn't found
	await open(page, `/pl/tickets/${theirs.id}`);
	await expect(page.getByText("Nie znaleziono biletu")).toBeVisible();
	await expect(page.getByRole("img", { name: "Kod QR biletu" })).toHaveCount(0);

	// And their own waitlisted ticket has no QR code yet
	await open(page, `/pl/tickets/${mine.id}`);
	await expect(
		page.getByText("Bilet pojawi się po awansie z listy rezerwowej"),
	).toBeVisible();
	await expect(page.getByRole("img", { name: "Kod QR biletu" })).toHaveCount(0);
});
