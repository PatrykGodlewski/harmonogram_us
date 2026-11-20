import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { checkInByTicketCode, setCheckedIn } from "../src/queries/check-in";
import {
	registerForEvent,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { cancelEvent } from "../src/queries/events";
import { eventRegistrations } from "../src/schema/event-registrations";
import { createEvent, createUser, rejectionCode, resetDb } from "./helpers";

beforeEach(resetDb);

async function ticketOf(eventId: string, userId: string) {
	const [row] = await db
		.select({
			id: eventRegistrations.id,
			ticketCode: eventRegistrations.ticketCode,
			checkedInAt: eventRegistrations.checkedInAt,
		})
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	if (!row) throw new Error("no registration");
	return row;
}

describe("check-in", () => {
	it("the first scan checks in; a second scan reports the original time", async () => {
		const eventId = await createEvent();
		const userId = await createUser("ala@x.test");
		await registerForEvent(eventId, userId, "pl");
		const { ticketCode } = await ticketOf(eventId, userId);

		const first = await checkInByTicketCode(eventId, ticketCode);
		expect(first).toMatchObject({ status: "checked-in", email: "ala@x.test" });
		const second = await checkInByTicketCode(eventId, ticketCode);
		expect(second.status).toBe("already-checked-in");
		expect(second.checkedInAt).toEqual(first.checkedInAt);
	});

	it("refuses another event's ticket, a waitlisted one, and a cancelled event", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const other = await createEvent();
		const holder = await createUser();
		const waiting = await createUser();
		const elsewhere = await createUser();
		await registerForEvent(eventId, holder, "pl");
		await registerForEvent(eventId, waiting, "pl");
		await registerForEvent(other, elsewhere, "pl");

		expect(
			await rejectionCode(
				checkInByTicketCode(eventId, (await ticketOf(other, elsewhere)).ticketCode),
			),
		).toBe("TICKET_NOT_FOUND");
		expect(
			await rejectionCode(
				checkInByTicketCode(eventId, (await ticketOf(eventId, waiting)).ticketCode),
			),
		).toBe("TICKET_WAITLISTED");
		await cancelEvent(eventId);
		expect(
			await rejectionCode(
				checkInByTicketCode(eventId, (await ticketOf(eventId, holder)).ticketCode),
			),
		).toBe("EVENT_CANCELLED");
	});

	it("promotion keeps attendance empty; the manual switch sets and clears it", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const holder = await createUser();
		const waiting = await createUser();
		await registerForEvent(eventId, holder, "pl");
		await registerForEvent(eventId, waiting, "pl");
		await unregisterFromEvent(eventId, holder);
		const promoted = await ticketOf(eventId, waiting);
		expect(promoted.checkedInAt).toBeNull();

		await setCheckedIn(eventId, promoted.id, true);
		expect((await ticketOf(eventId, waiting)).checkedInAt).toBeInstanceOf(Date);
		await setCheckedIn(eventId, promoted.id, false);
		expect((await ticketOf(eventId, waiting)).checkedInAt).toBeNull();
		expect(await rejectionCode(setCheckedIn(eventId, "missing", true))).toBe(
			"NOT_REGISTERED",
		);
	});
});
