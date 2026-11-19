import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	registerForAgendaItem,
	registerForEvent,
	unregisterFromAgendaItem,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { events } from "../src/schema/events";
import { createEvent, createItem, createUser, hoursFromNow, rejectionCode, resetDb, stateOf } from "./helpers";

beforeEach(resetDb);

async function endEvent(eventId: string) {
	await db
		.update(events)
		.set({ date: hoursFromNow(-3), endsAt: hoursFromNow(-1) })
		.where(eq(events.id, eventId));
}

describe("withdrawing after the event ended", () => {
	it("is rejected for the event and the registration stays", async () => {
		const eventId = await createEvent();
		const user = await createUser();
		await registerForEvent(eventId, user, "pl");
		await endEvent(eventId);
		expect(await rejectionCode(unregisterFromEvent(eventId, user))).toBe("EVENT_ENDED");
		expect(await stateOf(eventId, user)).toBe("registered");
	});

	it("is rejected for an agenda item", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { startsAt: hoursFromNow(24), endsAt: hoursFromNow(25) });
		const user = await createUser();
		await registerForAgendaItem(itemId, user, "pl");
		await endEvent(eventId);
		await db.execute(
			// the item itself is over too
			(await import("drizzle-orm")).sql`UPDATE agenda_items SET starts_at = now() - interval '2 hours', ends_at = now() - interval '90 minutes' WHERE id = ${itemId}`,
		);
		expect(await rejectionCode(unregisterFromAgendaItem(itemId, user))).toBe("EVENT_ENDED");
	});
});
