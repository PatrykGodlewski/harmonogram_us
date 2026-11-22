import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { expectAccessible } from "../fixtures/a11y";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

const teamsMock = () => `http://localhost:${process.env.TEAMS_PORT ?? "18082"}`;

type RecordedMeeting = {
	organizer: string;
	subject: string;
	startDateTime: string;
	joinWebUrl: string;
};

async function meetingFor(
	subject: string,
): Promise<RecordedMeeting | undefined> {
	const response = await fetch(`${teamsMock()}/__meetings`);
	const meetings = (await response.json()) as RecordedMeeting[];
	return meetings.find((meeting) => meeting.subject === subject);
}

test("[F23] organizator tworzy spotkanie Teams, a link widzą zapisani @organizator", async ({
	browser,
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		title: `Webinar ${randomBytes(4).toString("hex")}`,
		organizerId: organizer.id,
		status: "draft",
		attendanceMode: "online",
	});

	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));
	const checklist = page.getByRole("region", { name: "Przed publikacją" });
	const linkRow = checklist
		.getByRole("listitem")
		.filter({ hasText: "Link online" });
	await linkRow
		.getByRole("button", { name: "Utwórz spotkanie w Teams" })
		.click();
	await expect(linkRow.getByText("Gotowe")).toBeVisible();
	await expect(
		linkRow.getByRole("button", { name: "Utwórz spotkanie w Teams" }),
	).toHaveCount(0);

	// The meeting exists at the provider, for the event's title and time
	const meeting = await meetingFor(event.title);
	expect(meeting, "meeting recorded by the Graph stand-in").toBeTruthy();
	expect(meeting?.organizer).toBe("organizator@uczelnia.test");
	await expect(linkRow).toContainText(meeting?.joinWebUrl ?? "missing");
	await expectAccessible(page, "wydarzenie z Teams", event.title);

	await checklist.getByRole("button", { name: "Opublikuj" }).click();
	await expect(page.getByText("Szkic", { exact: true })).toHaveCount(0);

	// A registered person gets the link; a visitor does not
	const attendeeEmail = `a-${email}`;
	const attendee = await createTestUser(attendeeEmail);
	await registerForEvent(event.id, attendee.id, "pl");
	const attendeePage = await (await browser.newContext()).newPage();
	await signInByEmail(attendeePage, attendeeEmail);
	await open(attendeePage, `/pl/events/${event.id}`);
	await expect(
		attendeePage.getByRole("link", { name: "Dołącz online" }),
	).toHaveAttribute("href", meeting?.joinWebUrl ?? "missing");

	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${event.id}`);
	await expect(
		visitor.getByRole("link", { name: "Dołącz online" }),
	).toHaveCount(0);
});
