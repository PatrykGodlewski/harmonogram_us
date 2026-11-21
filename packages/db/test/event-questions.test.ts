import { beforeEach, describe, expect, it } from "vitest";
import {
	createEventQuestion,
	deleteEventQuestion,
	listEventQuestions,
	moveEventQuestion,
	updateEventQuestion,
} from "../src/queries/event-questions";
import { createEvent, rejectionCode, resetDb } from "./helpers";

beforeEach(resetDb);

describe("event questions", () => {
	it("are listed in order, can move and be deleted", async () => {
		const eventId = await createEvent();
		const a = await createEventQuestion({ eventId, label: "Kierunek", kind: "text", required: true });
		const b = await createEventQuestion({ eventId, label: "Rozmiar", kind: "choice", options: ["S", "M"] });
		await moveEventQuestion(b.id, "up");
		expect((await listEventQuestions(eventId)).map((q) => q.label)).toEqual(["Rozmiar", "Kierunek"]);
		await deleteEventQuestion(a.id);
		expect((await listEventQuestions(eventId)).map((q) => q.id)).toEqual([b.id]);
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
