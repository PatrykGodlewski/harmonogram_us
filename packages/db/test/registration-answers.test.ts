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
