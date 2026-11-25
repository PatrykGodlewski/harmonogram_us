import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authUsers } from "@repo/db/schema/better-auth";
import { eq } from "drizzle-orm";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/** Calendar apps join folded lines (RFC 5545) before reading them. */
function unfold(ics: string): string {
	return ics.replace(/\r\n /g, "");
}

test("[F4] plik ICS zawiera wydarzenie z poprawnym terminem i linkiem @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({});
	await registerForEvent(event.id, user.id, "pl");

	// "Add to calendar" on the event page gives a file with the event
	await open(page, `/pl/events/${event.id}`);
	const downloadPromise = page.waitForEvent("download");
	await page.getByRole("link", { name: "Dodaj do kalendarza" }).click();
	const ics = unfold(
		await readFile((await (await downloadPromise).path()) ?? "", "utf8"),
	);
	expect(ics).toContain(`SUMMARY:${event.title}`);
	expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
	expect(ics).toContain(`/pl/events/${event.id}`);

	// The campus calendar subscription is offered on the event list
	await open(page, "/pl");
	const campusFeed = page.getByRole("link", {
		name: "Subskrybuj kalendarz kampusu",
	});
	const campusHref = (await campusFeed.getAttribute("href")) ?? "";
	expect(campusHref).toMatch(/^webcal:\/\/.+\/api\/calendar\/events/);
	const campus = await page.request.get(
		campusHref.replace(/^webcal:/, "http:"),
	);
	// (The e2e database holds thousands of load-test events, past the feed's 500-event cap.)
	expect(campus.headers()["content-type"]).toContain("text/calendar");
	expect(await campus.text()).toContain("BEGIN:VEVENT");

	// The personal subscription on the account page lists my registration
	await signInByEmail(page, email);
	await open(page, "/pl/my-events");
	const feed = page.getByRole("textbox", {
		name: "Adres subskrypcji moich zapisów",
	});
	const feedUrl = await feed.inputValue();
	expect(feedUrl).toContain("/api/calendar/my/");
	const mine = await page.request.get(feedUrl);
	expect(mine.status()).toBe(200);
	expect(unfold(await mine.text())).toContain(`SUMMARY:${event.title}`);

	// A made-up token gives nothing away
	const fake = await page.request.get(
		feedUrl.replace(/my\/[^/]+$/, "my/zmyslony-token"),
	);
	expect(fake.status()).toBe(404);
	const [row] = await db
		.select({ token: authUsers.calendarToken })
		.from(authUsers)
		.where(eq(authUsers.id, user.id));
	expect(feedUrl).toContain(row?.token ?? "missing");
});
