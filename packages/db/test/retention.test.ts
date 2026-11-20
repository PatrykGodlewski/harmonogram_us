import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { getEventRegistrants, registerForEvent } from "../src/queries/event-registrations";
import { pruneOldRegistrations } from "../src/queries/retention";
import { events } from "../src/schema/events";
import { createEvent, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

const DAY = 86_400_000;

async function eventEndedDaysAgo(days: number) {
	const eventId = await createEvent();
	const userId = await createUser();
	await registerForEvent(eventId, userId, "pl");
	const end = new Date(Date.now() - days * DAY);
	await db
		.update(events)
		.set({ date: new Date(end.getTime() - 3_600_000), endsAt: end })
		.where(eq(events.id, eventId));
	return eventId;
}

describe("pruneOldRegistrations", () => {
	it("deletes registrations of events that ended longer ago than the retention period", async () => {
		const old = await eventEndedDaysAgo(400);
		const recent = await eventEndedDaysAgo(100);

		const result = await pruneOldRegistrations(new Date(), 365);

		expect(result.deleted).toBe(1);
		expect(await getEventRegistrants(old)).toHaveLength(0);
		expect(await getEventRegistrants(recent)).toHaveLength(1);
	});

	it("leaves upcoming events alone", async () => {
		const eventId = await createEvent();
		await registerForEvent(eventId, await createUser(), "pl");
		expect((await pruneOldRegistrations(new Date(), 0)).deleted).toBe(0);
	});
});
