import { beforeEach, describe, expect, it } from "vitest";
import { registerForEvent } from "../src/queries/event-registrations";
import { messageRegistrants } from "../src/queries/event-message";
import { createEvent, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function eventWithTwoRegisteredAndOneWaiting() {
	const eventId = await createEvent({ maxSeats: 2 });
	for (let n = 0; n < 3; n++) {
		await registerForEvent(eventId, await createUser(), "pl");
	}
	return eventId;
}

describe("messageRegistrants", () => {
	it.each([
		["registered", 2],
		["waitlisted", 1],
		["all", 3],
	] as const)("audience %s reaches %i people", async (audience, expected) => {
		const eventId = await eventWithTwoRegisteredAndOneWaiting();
		const reached: string[] = [];
		const result = await messageRegistrants(eventId, audience, async (_tx, ids) => {
			reached.push(...ids);
		});
		expect(result.recipients).toBe(expected);
		expect(reached).toHaveLength(expected);
	});

	it("an event without registrants queues nothing", async () => {
		const eventId = await createEvent();
		let called = false;
		const result = await messageRegistrants(eventId, "all", async () => {
			called = true;
		});
		expect(result.recipients).toBe(0);
		expect(called).toBe(false);
	});
});
