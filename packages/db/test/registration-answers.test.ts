import { beforeEach, describe, expect, it } from "vitest";
import { createEventQuestion } from "../src/queries/event-questions";
import {
	getEventRegistrants,
	registerForAgendaItem,
	registerForEvent,
} from "../src/queries/event-registrations";
import { createEvent, createItem, createUser, rejectionCode, resetDb } from "./helpers";

beforeEach(resetDb);

async function eventWithQuestions() {
	const eventId = await createEvent();
	const field = await createEventQuestion({ eventId, label: "Kierunek", kind: "text", required: true });
	const size = await createEventQuestion({ eventId, label: "Rozmiar", kind: "choice", options: ["S", "M"] });
	const photos = await createEventQuestion({ eventId, label: "Zdjęcia", kind: "yesno" });
	return { eventId, field, size, photos };
}

describe("registration answers", () => {
	it("a required question blocks registering without an answer", async () => {
		const { eventId, size } = await eventWithQuestions();
		const user = await createUser();
		expect(await rejectionCode(registerForEvent(eventId, user, "pl"))).toBe("ANSWERS_INVALID");
		expect(
			await rejectionCode(registerForEvent(eventId, user, "pl", undefined, { answers: { [size.id]: "S" } })),
		).toBe("ANSWERS_INVALID");
	});

	it("refuses a choice outside the options and a yes/no that is neither", async () => {
		const { eventId, field, size, photos } = await eventWithQuestions();
		const user = await createUser();
		expect(
			await rejectionCode(
				registerForEvent(eventId, user, "pl", undefined, { answers: { [field.id]: "Fizyka", [size.id]: "XXL" } }),
			),
		).toBe("ANSWERS_INVALID");
		expect(
			await rejectionCode(
				registerForEvent(eventId, user, "pl", undefined, { answers: { [field.id]: "Fizyka", [photos.id]: "maybe" } }),
			),
		).toBe("ANSWERS_INVALID");
	});

	it("stores the answers and shows them with the registrant; blank optional answers are left out", async () => {
		const { eventId, field, size, photos } = await eventWithQuestions();
		const user = await createUser();
		await registerForEvent(eventId, user, "pl", undefined, {
			answers: { [field.id]: "  Fizyka ", [size.id]: "M", [photos.id]: "" },
		});
		const [registrant] = await getEventRegistrants(eventId);
		expect(registrant?.answers).toEqual({ [field.id]: "Fizyka", [size.id]: "M" });
	});

	it("an organiser may add someone without answers; programme items need the answers first", async () => {
		const { eventId } = await eventWithQuestions();
		const itemId = await createItem(eventId);
		const added = await createUser();
		await expect(
			registerForEvent(eventId, added, "pl", undefined, { byOrganizer: true }),
		).resolves.toMatchObject({ state: "registered" });
		expect(await rejectionCode(registerForAgendaItem(itemId, await createUser(), "pl"))).toBe(
			"ANSWERS_INVALID",
		);
	});

	it("an event without questions keeps one-tap registration", async () => {
		const eventId = await createEvent();
		await expect(registerForEvent(eventId, await createUser(), "pl")).resolves.toMatchObject({
			state: "registered",
		});
	});
});

describe("editing answers", () => {
	it("the participant must keep required answers; the organiser may change them after the event", async () => {
		const { updateRegistrationAnswers } = await import("../src/queries/event-registrations");
		const { db } = await import("../src/client");
		const { events } = await import("../src/schema/events");
		const { eq } = await import("drizzle-orm");
		const { eventId, field } = await eventWithQuestions();
		const user = await createUser();
		await registerForEvent(eventId, user, "pl", undefined, { answers: { [field.id]: "Fizyka" } });
		const [registrant] = await getEventRegistrants(eventId);
		const id = registrant?.registrationId ?? "";
		expect(
			await rejectionCode(updateRegistrationAnswers(eventId, id, { [field.id]: "" }, { byOrganizer: false })),
		).toBe("ANSWERS_INVALID");
		await updateRegistrationAnswers(eventId, id, { [field.id]: "Chemia" }, { byOrganizer: false });
		expect((await getEventRegistrants(eventId))[0]?.answers).toEqual({ [field.id]: "Chemia" });

		await db
			.update(events)
			.set({ date: new Date(Date.now() - 3 * 86_400_000), endsAt: new Date(Date.now() - 2 * 86_400_000) })
			.where(eq(events.id, eventId));
		expect(
			await rejectionCode(updateRegistrationAnswers(eventId, id, { [field.id]: "X" }, { byOrganizer: false })),
		).toBe("EVENT_ENDED");
		await updateRegistrationAnswers(eventId, id, { [field.id]: "Biologia" }, { byOrganizer: true });
		expect((await getEventRegistrants(eventId))[0]?.answers).toEqual({ [field.id]: "Biologia" });
	});
});
