import { randomBytes } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import {
	createEventQuestion,
	listEventQuestions,
} from "@repo/db/queries/event-questions";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { submitSurvey } from "@repo/db/queries/surveys";
import { eventRegistrations } from "@repo/db/schema/event-registrations";
import { events } from "@repo/db/schema/events";
import { surveyAnswers } from "@repo/db/schema/surveys";
import { eq, inArray } from "drizzle-orm";
import { expectAccessible } from "../fixtures/a11y";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
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

test("[F20] ocena w ankiecie ma opisane końce skali @uczestnik", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const person = await createTestUser(base);
	const { event } = await endedEventWithSurvey();
	await registerForEvent(event.id, person.id, "pl");
	await endEvent(event.id);
	await sendSurveyEmails();
	const message = await latestMessageTo(base, { subject: "Ankieta" });

	await open(
		page,
		message.links.find((href) => href.includes("/surveys/")) ?? "",
	);
	await expect(page.getByText("1 = bardzo źle")).toBeVisible();
	await expect(page.getByText("5 = bardzo dobrze")).toBeVisible();
});

test("[F20] strony z osobistym linkiem nie wysyłają adresu strony dalej @uczestnik", async ({
	page,
}) => {
	const token = "x".repeat(43);
	for (const path of [
		`/pl/surveys/nope?token=${token}`,
		`/pl/registrations/nope/withdraw?token=${token}`,
		`/pl/guest/confirm?token=${token}`,
	]) {
		await open(page, path);
		await expect(page.locator('meta[name="referrer"]'), path).toHaveAttribute(
			"content",
			"no-referrer",
		);
	}
});

async function addSurveyQuestion(
	page: Page,
	question: { label: string; kind: string; required?: boolean },
) {
	await page.getByRole("button", { name: "Dodaj pytanie do ankiety" }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByLabel("Treść pytania").fill(question.label);
	await dialog.getByRole("combobox", { name: "Rodzaj odpowiedzi" }).click();
	await page.getByRole("option", { name: question.kind }).click();
	if (question.required) {
		await dialog.getByLabel("Odpowiedź wymagana").check();
	}
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();
}

test("[F20] organizator układa ankietę i widzi podsumowanie @organizator", async ({
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

	const survey = page.getByRole("region", { name: "Ankieta po wydarzeniu" });
	await addSurveyQuestion(page, {
		label: "Jak oceniasz wydarzenie?",
		kind: "Ocena 1–5",
		required: true,
	});
	await addSurveyQuestion(page, {
		label: "Polecisz innym?",
		kind: "Tak / nie",
	});
	await addSurveyQuestion(page, { label: "Uwagi", kind: "Tekst" });
	await expect(survey.getByRole("listitem")).toHaveCount(3);
	// Registration stays one tap: the survey questions are not asked there
	await expect(
		page
			.getByRole("region", { name: "Pytania przy zapisie" })
			.getByRole("listitem"),
	).toHaveCount(0);
	// A rating is not offered for registration questions
	await page
		.getByRole("button", { name: "Dodaj pytanie", exact: true })
		.click();
	await page.getByRole("combobox", { name: "Rodzaj odpowiedzi" }).click();
	await expect(page.getByRole("option", { name: "Ocena 1–5" })).toHaveCount(0);
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "Anuluj" }).click();

	// Three people held a place; two answered after the event
	const people = [];
	for (const n of [1, 2, 3]) {
		const user = await createTestUser(`${n}-${email}`);
		await registerForEvent(event.id, user.id, "pl");
		people.push(user.id);
	}
	await endEvent(event.id);
	const [rating, recommend, notes] = await listEventQuestions(
		event.id,
		"survey",
	);
	const registrations = await db
		.select({ id: eventRegistrations.id, userId: eventRegistrations.userId })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.eventId, event.id));
	const idOf = (userId: string | undefined) =>
		registrations.find((row) => row.userId === userId)?.id ?? "";
	await submitSurvey(idOf(people[0]), {
		[rating?.id ?? ""]: "4",
		[recommend?.id ?? ""]: "yes",
		[notes?.id ?? ""]: "Za krótkie przerwy",
	});
	await submitSurvey(idOf(people[1]), {
		[rating?.id ?? ""]: "5",
		[recommend?.id ?? ""]: "no",
	});

	await open(page, adminUrl(`/pl/events/${event.id}`));
	const results = page.getByRole("region", { name: "Wyniki ankiety" });
	await expect(results).toContainText("2 z 3 osób");
	await expect(results).toContainText("Średnia 4,5");
	await expect(results).toContainText("Tak: 1 (50%)");
	// One text answer is not enough to show it without pointing at a person
	await expect(results).toContainText(
		"Odpowiedzi tekstowe pokażemy, gdy będą co najmniej 3, żeby nie dało się ich przypisać do osoby.",
	);
	await expect(results).not.toContainText("Za krótkie przerwy");
	await expectAccessible(page, "wydarzenie z ankietą", event.title);
});
