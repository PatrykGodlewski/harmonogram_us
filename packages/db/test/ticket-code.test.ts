import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	registerForAgendaItem,
	registerForEvent,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { eventRegistrations } from "../src/schema/event-registrations";
import { createEvent, createItem, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function ticketCodeOf(eventId: string, userId: string) {
	const [row] = await db.execute<{ ticket_code: string }>(sql`
		SELECT ticket_code FROM event_registrations WHERE event_id = ${eventId} AND user_id = ${userId}
	`);
	return row?.ticket_code;
}

describe("ticket code", () => {
	it("every registration gets its own 64-character hex code", async () => {
		const eventId = await createEvent();
		const [a, b] = [await createUser(), await createUser()];
		await registerForEvent(eventId, a, "pl");
		await registerForEvent(eventId, b, "pl");
		const [codeA, codeB] = [await ticketCodeOf(eventId, a), await ticketCodeOf(eventId, b)];
		expect(codeA).toMatch(/^[0-9a-f]{64}$/);
		expect(codeB).toMatch(/^[0-9a-f]{64}$/);
		expect(codeA).not.toBe(codeB);
	});

	it("promotion from the waitlist keeps the code", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, b] = [await createUser(), await createUser()];
		await registerForEvent(eventId, a, "pl");
		await registerForEvent(eventId, b, "pl");
		const before = await ticketCodeOf(eventId, b);
		await unregisterFromEvent(eventId, a);
		const [row] = await db
			.select({ state: eventRegistrations.state })
			.from(eventRegistrations)
			.where(eq(eventRegistrations.userId, b));
		expect(row?.state).toBe("registered");
		expect(await ticketCodeOf(eventId, b)).toBe(before);
	});

	it("registering for an agenda item keeps the code", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const user = await createUser();
		await registerForEvent(eventId, user, "pl");
		const before = await ticketCodeOf(eventId, user);
		await registerForAgendaItem(itemId, user, "pl");
		expect(await ticketCodeOf(eventId, user)).toBe(before);
	});
});
