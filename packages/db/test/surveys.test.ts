import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { createEventQuestion } from "../src/queries/event-questions";
import { registerForEvent } from "../src/queries/event-registrations";
import {
	getSurveyForRegistration,
	getSurveySummary,
	queueSurveyInvitations,
	SURVEY_OPEN_DAYS,
	submitSurvey,
} from "../src/queries/surveys";
import { authUsers } from "../src/schema/better-auth";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import { surveyAnswers } from "../src/schema/surveys";
import { createEvent, createUser, rejectionCode, resetDb } from "./helpers";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

beforeEach(resetDb);

/** An event with a survey that ended an hour ago (by default), and its registrations. */
async function endedEventWithSurvey({
	seats = 10,
	people = 1,
	endedAgo = HOUR,
}: { seats?: number; people?: number; endedAgo?: number } = {}) {
	const eventId = await createEvent({ maxSeats: seats });
	const rating = await createEventQuestion({
		eventId,
		form: "survey",
		label: "Ocena",
		kind: "rating",
		required: true,
	});
	const recommend = await createEventQuestion({
		eventId,
		form: "survey",
		label: "Polecisz?",
		kind: "yesno",
	});
	const notes = await createEventQuestion({
		eventId,
		form: "survey",
		label: "Uwagi",
		kind: "text",
	});
	const registrationIds: string[] = [];
	for (let i = 0; i < people; i++) {
		const userId = await createUser();
		await registerForEvent(eventId, userId, "pl");
		const [row] = await db
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(eq(eventRegistrations.userId, userId));
		registrationIds.push(row?.id ?? "");
	}
	const end = new Date(Date.now() - endedAgo);
	await db
		.update(events)
		.set({ date: new Date(end.getTime() - 2 * HOUR), endsAt: end })
		.where(eq(events.id, eventId));
	return { eventId, registrationIds, rating, recommend, notes };
}

describe("survey availability", () => {
	it("is open after the event ends, for SURVEY_OPEN_DAYS days", async () => {
		const open = await endedEventWithSurvey();
		const survey = await getSurveyForRegistration(open.registrationIds[0] ?? "");
		expect(survey?.status).toBe("open");
		expect(survey?.questions.map((q) => q.label)).toEqual(["Ocena", "Polecisz?", "Uwagi"]);

		const old = await endedEventWithSurvey({ endedAgo: (SURVEY_OPEN_DAYS + 1) * DAY });
		expect((await getSurveyForRegistration(old.registrationIds[0] ?? ""))?.status).toBe("closed");
		expect(await rejectionCode(submitSurvey(old.registrationIds[0] ?? "", { [old.rating.id]: "5" }))).toBe(
			"SURVEY_CLOSED",
		);
	});

	it("is closed before the event ends and for a cancelled event", async () => {
		const { eventId, registrationIds, rating } = await endedEventWithSurvey({ endedAgo: -HOUR });
		const id = registrationIds[0] ?? "";
		expect((await getSurveyForRegistration(id))?.status).toBe("closed");
		await db
			.update(events)
			.set({ date: new Date(Date.now() - 3 * HOUR), endsAt: new Date(Date.now() - HOUR), status: "cancelled" })
			.where(eq(events.id, eventId));
		expect(await rejectionCode(submitSurvey(id, { [rating.id]: "4" }))).toBe("SURVEY_CLOSED");
	});

	it("is not there for a waitlisted person or an event without a survey", async () => {
		const { registrationIds } = await endedEventWithSurvey({ seats: 1, people: 2 });
		expect(await getSurveyForRegistration(registrationIds[1] ?? "")).toBeNull();

		const bare = await createEvent();
		const userId = await createUser();
		await registerForEvent(bare, userId, "pl");
		const [row] = await db
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(eq(eventRegistrations.userId, userId));
		expect(await getSurveyForRegistration(row?.id ?? "")).toBeNull();
		expect(await getSurveyForRegistration("nope")).toBeNull();
	});
});

describe("submitting a survey", () => {
	it("takes one response per registration", async () => {
		const { registrationIds, rating, notes } = await endedEventWithSurvey();
		const id = registrationIds[0] ?? "";
		await submitSurvey(id, { [rating.id]: "5", [notes.id]: "  Świetne  " });
		expect((await getSurveyForRegistration(id))?.status).toBe("answered");
		expect(await rejectionCode(submitSurvey(id, { [rating.id]: "1" }))).toBe("SURVEY_ANSWERED");
		const answers = await db.select({ value: surveyAnswers.value }).from(surveyAnswers);
		expect(answers.map((a) => a.value).sort()).toEqual(["5", "Świetne"]);
	});

	it("stores one response when the same link is sent twice at once", async () => {
		const { registrationIds, rating } = await endedEventWithSurvey();
		const id = registrationIds[0] ?? "";
		const results = await Promise.all([
			rejectionCode(submitSurvey(id, { [rating.id]: "5" })),
			rejectionCode(submitSurvey(id, { [rating.id]: "4" })),
		]);
		expect(results.sort()).toEqual(["RESOLVED", "SURVEY_ANSWERED"]);
		expect(await db.select().from(surveyAnswers)).toHaveLength(1);
	});

	it("needs the required answers and a rating from 1 to 5", async () => {
		const { registrationIds, rating, notes } = await endedEventWithSurvey();
		const id = registrationIds[0] ?? "";
		expect(await rejectionCode(submitSurvey(id, { [notes.id]: "bez oceny" }))).toBe("ANSWERS_INVALID");
		expect(await rejectionCode(submitSurvey(id, { [rating.id]: "6" }))).toBe("ANSWERS_INVALID");
		expect(await rejectionCode(submitSurvey(id, { [rating.id]: "0" }))).toBe("ANSWERS_INVALID");
		// A rejected attempt leaves the survey open
		expect((await getSurveyForRegistration(id))?.status).toBe("open");
	});

	it("keeps answers anonymous when the account is deleted", async () => {
		const { registrationIds, rating } = await endedEventWithSurvey();
		await submitSurvey(registrationIds[0] ?? "", { [rating.id]: "3" });
		await db.execute(sql`DELETE FROM ${authUsers}`);
		expect(await db.select().from(surveyAnswers)).toHaveLength(1);
	});
});

describe("survey summary", () => {
	it("counts, averages and lists answers", async () => {
		const { eventId, registrationIds, rating, recommend, notes } = await endedEventWithSurvey({ people: 3 });
		const [a, b] = registrationIds;
		await submitSurvey(a ?? "", { [rating.id]: "4", [recommend.id]: "yes", [notes.id]: "Dobre" });
		await submitSurvey(b ?? "", { [rating.id]: "5", [recommend.id]: "no" });

		const summary = await getSurveySummary(eventId);
		expect(summary.responses).toBe(2);
		expect(summary.invited).toBe(3);
		expect(summary.questions).toEqual([
			{ id: rating.id, label: "Ocena", kind: "rating", average: 4.5, counts: [0, 0, 0, 1, 1] },
			{
				id: recommend.id,
				label: "Polecisz?",
				kind: "yesno",
				options: [
					{ value: "yes", count: 1 },
					{ value: "no", count: 1 },
				],
			},
			{ id: notes.id, label: "Uwagi", kind: "text", total: 1, answers: ["Dobre"] },
		]);
	});

	it("gives empty results before anyone answers", async () => {
		const { eventId } = await endedEventWithSurvey();
		const summary = await getSurveySummary(eventId);
		expect(summary.responses).toBe(0);
		expect(summary.questions[0]).toMatchObject({ average: null, counts: [0, 0, 0, 0, 0] });
	});
});

describe("survey invitations", () => {
	it("claims each person once, only while the survey is open", async () => {
		const open = await endedEventWithSurvey({ seats: 1, people: 2 });
		await endedEventWithSurvey({ endedAgo: (SURVEY_OPEN_DAYS + 1) * DAY });
		await endedEventWithSurvey({ endedAgo: -HOUR });

		const claimed: string[] = [];
		const first = await queueSurveyInvitations(new Date(), async (_tx, ids) => {
			claimed.push(...ids);
		});
		expect(first.registrations).toBe(1);
		expect(claimed).toEqual([open.registrationIds[0]]);
		const second = await queueSurveyInvitations(new Date(), async () => {});
		expect(second.registrations).toBe(0);
	});
});
