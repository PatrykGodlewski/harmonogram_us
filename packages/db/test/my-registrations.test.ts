import { beforeEach, describe, expect, it } from "vitest";
import {
	registerForAgendaItem,
	registerForEvent,
} from "../src/queries/event-registrations";
import { listMyRegistrations } from "../src/queries/my-registrations";
import { createEvent, createItem, createUser, hoursFromNow, resetDb } from "./helpers";

beforeEach(resetDb);

describe("listMyRegistrations", () => {
	it("lists only the user's registrations, sorted by date, with state, waitlist position and agenda items", async () => {
		const [me, other] = [await createUser(), await createUser()];
		const later = await createEvent({ maxSeats: 1, date: hoursFromNow(24 * 9) });
		const sooner = await createEvent({ date: hoursFromNow(24 * 2) });
		const itemEnd = hoursFromNow(24 * 2 + 1);
		const item = await createItem(sooner, { startsAt: hoursFromNow(24 * 2), endsAt: itemEnd });
		await registerForEvent(later, other, "pl");
		await registerForEvent(later, me, "pl");
		await registerForAgendaItem(item, me, "pl");
		const notMine = await createEvent();
		await registerForEvent(notMine, other, "pl");

		const list = await listMyRegistrations(me);

		expect(list.map((row) => row.eventId)).toEqual([sooner, later]);
		expect(list[0]).toMatchObject({
			state: "registered",
			waitlistPosition: null,
			items: [expect.objectContaining({ id: item })],
		});
		expect(list[0]?.registrationId).toEqual(expect.any(String));
		expect(list[0]?.effectiveEndsAt.getTime()).toBe(itemEnd.getTime());
		expect(list[1]).toMatchObject({ state: "waitlisted", waitlistPosition: 1, items: [] });
	});
});
