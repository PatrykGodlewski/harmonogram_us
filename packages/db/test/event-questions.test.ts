import { beforeEach, describe, expect, it } from "vitest";
import {
	createEventQuestion,
	deleteEventQuestion,
	listEventQuestions,
	moveEventQuestion,
	updateEventQuestion,
} from "../src/queries/event-questions";
import { registerForEvent } from "../src/queries/event-registrations";
import { createEvent, createUser, rejectionCode, resetDb } from "./helpers";

beforeEach(resetDb);

describe("event questions", () => {
	it("are listed in order, can move and be deleted", async () => {
		const eventId = await createEvent();
		const a = await createEventQuestion({ eventId, label: "Kierunek", kind: "text", required: true });
		const b = await createEventQuestion({ eventId, label: "Rozmiar", kind: "choice", options: ["S", "M"] });
		await moveEventQuestion(b.id, "up");
		expect((await listEventQuestions(eventId, "registration")).map((q) => q.label)).toEqual(["Rozmiar", "Kierunek"]);
		await deleteEventQuestion(a.id);
		expect((await listEventQuestions(eventId, "registration")).map((q) => q.id)).toEqual([b.id]);
	});

	it("a choice needs at least two distinct options; others keep none", async () => {
		const eventId = await createEvent();
		expect(
			await rejectionCode(createEventQuestion({ eventId, label: "X", kind: "choice", options: ["S", " S "] })),
		).toBe("QUESTION_OPTIONS");
		const yesno = await createEventQuestion({ eventId, label: "Zgoda", kind: "yesno", options: ["a", "b"] });
		expect(yesno.options).toEqual([]);
		const updated = await updateEventQuestion(yesno.id, { label: "Zgoda na zdjęcia", required: true });
		expect(updated).toMatchObject({ label: "Zgoda na zdjęcia", required: true });
	});
});

describe("survey questions", () => {
	it("are listed and moved apart from registration questions", async () => {
		const eventId = await createEvent();
		const reg = await createEventQuestion({ eventId, label: "Kierunek", kind: "text" });
		const s1 = await createEventQuestion({ eventId, form: "survey", label: "Ocena", kind: "rating" });
		const s2 = await createEventQuestion({ eventId, form: "survey", label: "Uwagi", kind: "text" });
		expect((await listEventQuestions(eventId, "registration")).map((q) => q.id)).toEqual([reg.id]);
		await moveEventQuestion(s1.id, "up");
		await moveEventQuestion(s2.id, "up");
		expect((await listEventQuestions(eventId, "survey")).map((q) => q.id)).toEqual([s2.id, s1.id]);
		expect((await listEventQuestions(eventId, "registration")).map((q) => q.id)).toEqual([reg.id]);
	});

	it("a rating belongs only to a survey", async () => {
		const eventId = await createEvent();
		expect(await rejectionCode(createEventQuestion({ eventId, label: "Ocena", kind: "rating" }))).toBe(
			"QUESTION_KIND",
		);
		const text = await createEventQuestion({ eventId, label: "Kierunek", kind: "text" });
		expect(await rejectionCode(updateEventQuestion(text.id, { kind: "rating" }))).toBe("QUESTION_KIND");
	});

	it("registering ignores required survey questions", async () => {
		const eventId = await createEvent();
		await createEventQuestion({ eventId, form: "survey", label: "Ocena", kind: "rating", required: true });
		const userId = await createUser();
		expect((await registerForEvent(eventId, userId, "pl")).state).toBe("registered");
	});
});
