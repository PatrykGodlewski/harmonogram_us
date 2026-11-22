import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { createEventQuestion } from "@repo/db/queries/event-questions";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { events } from "@repo/db/schema/events";
import { surveyAnswers } from "@repo/db/schema/surveys";
import { eq, inArray } from "drizzle-orm";
import { expectAccessible } from "../fixtures/a11y";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo, messageCountTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

/** An event with a three-question survey that ended an hour ago. */
async function endedEventWithSurvey(maxSeats = 10) {
	const event = await createTestEvent({ maxSeats });
	const questions = [
		await createEventQuestion({
			eventId: event.id,
			form: "survey",
			label: "Jak oceniasz wydarzenie?",
			kind: "rating",
			required: true,
		}),
		await createEventQuestion({
			eventId: event.id,
			form: "survey",
			label: "Polecisz innym?",
			kind: "yesno",
		}),
		await createEventQuestion({
			eventId: event.id,
			form: "survey",
			label: "Uwagi",
			kind: "text",
		}),
	];
	return { event, questionIds: questions.map((q) => q.id) };
}

async function endEvent(eventId: string) {
	const end = new Date(Date.now() - 3_600_000);
	await db
		.update(events)
		.set({ date: new Date(end.getTime() - 2 * 3_600_000), endsAt: end })
		.where(eq(events.id, eventId));
}

async function sendSurveyEmails() {
	const { queueSurveyEmails } = await import("@repo/api/notifications/surveys");
	await queueSurveyEmails(new Date());
}

test("[F20] uczestnik wypełnia ankietę z linku w e-mailu @uczestnik", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const person = await createTestUser(`p-${base}`);
	const waiting = await createTestUser(`w-${base}`);
	const { event, questionIds } = await endedEventWithSurvey(1);
	await registerForEvent(event.id, person.id, "pl");
	await registerForEvent(event.id, waiting.id, "pl");
	await endEvent(event.id);
	await sendSurveyEmails();

	const message = await latestMessageTo(`p-${base}`, { subject: "Ankieta" });
	expect(message.subject).toContain(event.title);
	const link = message.links.find((href) => href.includes("/surveys/"));
	expect(link, "survey link in the e-mail").toBeTruthy();

	await open(page, link ?? "");
	await expect(page.getByRole("heading", { level: 1 })).toContainText(
		event.title,
	);
	await expectAccessible(page, "ankieta", "Ankieta");
	// The rating is required
	await page.getByRole("button", { name: "Wyślij odpowiedzi" }).click();
	await expect(page.getByText("Ta odpowiedź jest wymagana")).toBeVisible();

	await page.getByLabel("Jak oceniasz wydarzenie?").click();
	await page.getByRole("option", { name: "4" }).click();
	await page.getByLabel("Polecisz innym?").click();
	await page.getByRole("option", { name: "Tak" }).click();
	await page.getByLabel("Uwagi").fill("Więcej przerw");
	await page.getByRole("button", { name: "Wyślij odpowiedzi" }).click();
	await expect(page.getByRole("status")).toContainText(
		"Dziękujemy za odpowiedzi",
	);
	const stored = await db
		.select({ value: surveyAnswers.value })
		.from(surveyAnswers)
		.where(inArray(surveyAnswers.questionId, questionIds));
	expect(stored.map((row) => row.value).sort()).toEqual([
		"4",
		"Więcej przerw",
		"yes",
	]);

	// The same link again: already answered
	await open(page, link ?? "");
	await expect(page.getByText("Ta ankieta jest już wypełniona")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Wyślij odpowiedzi" }),
	).toHaveCount(0);

	// The person on the waitlist never held a place: no survey for them
	expect(await messageCountTo(`w-${base}`)).toBe(0);
});

test("[F20] zmieniony link do ankiety nie działa @uczestnik", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const person = await createTestUser(base);
	const { event } = await endedEventWithSurvey();
	await registerForEvent(event.id, person.id, "pl");
	await endEvent(event.id);
	await sendSurveyEmails();
	const message = await latestMessageTo(base, { subject: "Ankieta" });
	const link = new URL(
		message.links.find((href) => href.includes("/surveys/")) ?? "",
	);
	link.searchParams.set("token", "x".repeat(43));

	await open(page, link.toString());
	await expect(page.getByRole("alert")).toContainText(
		"Ten link do ankiety jest nieprawidłowy",
	);
	await expect(
		page.getByRole("button", { name: "Wyślij odpowiedzi" }),
	).toHaveCount(0);
});
