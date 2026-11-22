import { beforeEach, describe, expect, it } from "vitest";
import {
	getMyRegistrations,
	registerForAgendaItem,
	registerForEvent,
	unregisterFromAgendaItem,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	readEventCount,
	readItemCount,
	rejectionCode,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

describe("event end", () => {
	it("EVENT_ENDED for event registration after effective end", async () => {
		const user = await createUser();
		const past = await createEvent({ date: hoursFromNow(-48) });
		expect(await rejectionCode(registerForEvent(past, user, "pl"))).toBe(
			"EVENT_ENDED",
		);

		const extended = await createEvent({
			date: hoursFromNow(-48),
			endsAt: hoursFromNow(1),
		});
		await expect(registerForEvent(extended, user, "pl")).resolves.toHaveProperty(
			"state",
		);
	});

	it("EVENT_ENDED for item registration after event end", async () => {
		const eventId = await createEvent({
			date: hoursFromNow(-3),
			endsAt: hoursFromNow(-1),
		});
		const itemId = await createItem(eventId, {
			startsAt: hoursFromNow(-2),
			endsAt: hoursFromNow(1),
		});
		expect(
			await rejectionCode(registerForAgendaItem(itemId, await createUser())),
		).toBe("EVENT_ENDED");
	});

	it("effective end falls back to last agenda item", async () => {
		const eventId = await createEvent({ date: hoursFromNow(-48) });
		await createItem(eventId, {
			startsAt: hoursFromNow(1),
			endsAt: hoursFromNow(3),
		});
		await expect(
			registerForEvent(eventId, await createUser(), "pl"),
		).resolves.toHaveProperty("state");
	});
});

describe("agenda item registration", () => {
	it("registers item and creates event registration", async () => {
		const eventId = await createEvent({ maxSeats: 5 });
		const itemId = await createItem(eventId, { maxSeats: 3 });
		const user = await createUser();

		const result = await registerForAgendaItem(itemId, user);
		expect(result.eventRegistered).toBe(true);
		expect(await getMyRegistrations(user)).toEqual({
			events: [{ eventId: eventId, state: "registered", waitlistPosition: null }],
			agendaItemIds: [itemId],
		});
		expect((await readItemCount(itemId))?.seatsRemaining).toBe(2);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(4);
	});

	it("second item reuses event registration", async () => {
		const eventId = await createEvent({ maxSeats: 5 });
		const first = await createItem(eventId);
		const second = await createItem(eventId);
		const user = await createUser();

		await registerForAgendaItem(first, user);
		const result = await registerForAgendaItem(second, user);
		expect(result.eventRegistered).toBe(false);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(4);
	});

	it("ITEM_FULL when item has no seats", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 1 });
		await registerForAgendaItem(itemId, await createUser());
		expect(
			await rejectionCode(registerForAgendaItem(itemId, await createUser())),
		).toBe("ITEM_FULL");
	});

	it("item registration rolls back when event full", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const itemId = await createItem(eventId);
		await registerForEvent(eventId, await createUser(), "pl");
		const late = await createUser();

		expect(await rejectionCode(registerForAgendaItem(itemId, late))).toBe(
			"EVENT_FULL",
		);
		expect(await getMyRegistrations(late)).toEqual({
			events: [],
			agendaItemIds: [],
		});
	});

	it("rejects non-registrable, unknown and repeated registrations", async () => {
		const eventId = await createEvent();
		const open = await createItem(eventId, { requiresRegistration: false });
		const itemId = await createItem(eventId);
		const user = await createUser();

		expect(await rejectionCode(registerForAgendaItem(open, user))).toBe(
			"ITEM_NOT_REGISTRABLE",
		);
		expect(await rejectionCode(registerForAgendaItem("missing", user))).toBe(
			"ITEM_NOT_FOUND",
		);
		await registerForAgendaItem(itemId, user);
		expect(await rejectionCode(registerForAgendaItem(itemId, user))).toBe(
			"ALREADY_REGISTERED",
		);
	});

	it("ITEM_ENDED only after the item ends", async () => {
		const eventId = await createEvent({ endsAt: hoursFromNow(5) });
		const ended = await createItem(eventId, {
			startsAt: hoursFromNow(-2),
			endsAt: hoursFromNow(-1),
		});
		const running = await createItem(eventId, {
			startsAt: hoursFromNow(-1),
			endsAt: hoursFromNow(1),
		});
		const user = await createUser();

		expect(await rejectionCode(registerForAgendaItem(ended, user))).toBe(
			"ITEM_ENDED",
		);
		await expect(registerForAgendaItem(running, user)).resolves.toBeDefined();
	});

	it("unregister item keeps event registration", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const user = await createUser();
		await registerForAgendaItem(itemId, user);

		await expect(unregisterFromAgendaItem(itemId, user)).resolves.toBeUndefined();
		expect(await getMyRegistrations(user)).toEqual({
			events: [{ eventId: eventId, state: "registered", waitlistPosition: null }],
			agendaItemIds: [],
		});
		expect(await rejectionCode(unregisterFromAgendaItem(itemId, user))).toBe(
			"NOT_REGISTERED",
		);
	});

	it("unregister event removes item registrations", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 3 });
		const user = await createUser();
		await registerForAgendaItem(itemId, user);

		await unregisterFromEvent(eventId, user);
		expect((await getMyRegistrations(user)).agendaItemIds).toEqual([]);
		expect((await readItemCount(itemId))?.seatsRemaining).toBe(3);
	});
});

describe("concurrency", () => {
	it("concurrent last item seat", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 1 });
		const [a, b] = [await createUser(), await createUser()];

		const results = await Promise.allSettled([
			registerForAgendaItem(itemId, a),
			registerForAgendaItem(itemId, b),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		const rejected = results.find((r) => r.status === "rejected");
		expect(
			(rejected as PromiseRejectedResult).reason.code,
		).toBe("ITEM_FULL");
		expect((await readItemCount(itemId))?.seatsRemaining).toBe(0);
	});

	it("concurrent last event seat: one registered, one waitlisted", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, b] = [await createUser(), await createUser()];

		const results = await Promise.all([
			registerForEvent(eventId, a, "pl"),
			registerForEvent(eventId, b, "pl"),
		]);
		expect(results.map((r) => r.state).sort()).toEqual(["registered", "waitlisted"]);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});
});
