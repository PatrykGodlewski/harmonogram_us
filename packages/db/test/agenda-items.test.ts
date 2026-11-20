import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	createAgendaItem,
	listAgendaItems,
	updateAgendaItem,
} from "../src/queries/agenda-items";
import {
	getEventRegistrants,
	registerForAgendaItem,
	registerForEvent,
} from "../src/queries/event-registrations";
import { getEventById, updateEvent } from "../src/queries/events";
import { eventLocations } from "../src/schema/event-lookups";
import {
	createEvent,
	createUser,
	hoursFromNow,
	rejectionCode,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

describe("agenda item CRUD", () => {
	it("create/list orders by start then title", async () => {
		const eventId = await createEvent();
		await db
			.insert(eventLocations)
			.values({ id: "lab-2", slug: "lab-2", label: "Lab 2" });
		const base = { eventId, endsAt: hoursFromNow(30) };
		const sameStart = hoursFromNow(25);
		await createAgendaItem({ ...base, title: "B", startsAt: sameStart });
		await createAgendaItem({ ...base, title: "A", startsAt: sameStart });
		await createAgendaItem({
			...base,
			title: "Z",
			startsAt: hoursFromNow(24),
			locationId: "lab-2",
			maxSeats: 5,
		});

		const items = await listAgendaItems(eventId);
		expect(items.map((item) => item.title)).toEqual(["Z", "A", "B"]);
		expect(items[0]).toMatchObject({
			locationLabel: "Lab 2",
			maxSeats: 5,
			seatsRemaining: 5,
			registeredCount: 0,
			requiresRegistration: true,
		});
	});

	it("update item max_seats below registered → MAX_SEATS_BELOW_REGISTERED", async () => {
		const eventId = await createEvent();
		const item = await createAgendaItem({
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
			maxSeats: 3,
		});
		await registerForAgendaItem(item.id, await createUser());
		await registerForAgendaItem(item.id, await createUser());

		expect(await rejectionCode(updateAgendaItem(item.id, { maxSeats: 1 }))).toBe(
			"MAX_SEATS_BELOW_REGISTERED",
		);
	});

	it("item limit above event limit → ITEM_LIMIT_ABOVE_EVENT", async () => {
		const eventId = await createEvent({ maxSeats: 10 });
		const input = {
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		};
		expect(await rejectionCode(createAgendaItem({ ...input, maxSeats: 11 }))).toBe(
			"ITEM_LIMIT_ABOVE_EVENT",
		);

		const item = await createAgendaItem({ ...input, maxSeats: 10 });
		expect(
			await rejectionCode(updateAgendaItem(item.id, { maxSeats: 11 })),
		).toBe("ITEM_LIMIT_ABOVE_EVENT");
		await expect(createAgendaItem({ ...input, maxSeats: null })).resolves.toMatchObject({
			maxSeats: null,
		});
	});
});

describe("events", () => {
	it("update event max_seats below registered → MAX_SEATS_BELOW_REGISTERED", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		await registerForEvent(eventId, await createUser());
		await registerForEvent(eventId, await createUser());

		expect(await rejectionCode(updateEvent({ id: eventId, maxSeats: 1 }))).toBe(
			"MAX_SEATS_BELOW_REGISTERED",
		);
	});

	it("getEventById returns description and agenda", async () => {
		const eventId = await createEvent();
		await updateEvent({ id: eventId, description: "Open day" });
		await createAgendaItem({
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(26),
		});

		const event = await getEventById(eventId, "manage");
		expect(event).toMatchObject({ id: eventId, description: "Open day" });
		expect(event?.agenda.map((item) => item.title)).toEqual(["Lasers"]);
		expect(event?.effectiveEndsAt).toBeInstanceOf(Date);
		expect(await getEventById("missing", "manage")).toBeNull();
	});

	it("getEventRegistrants lists users with their item ids", async () => {
		const eventId = await createEvent();
		const item = await createAgendaItem({
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		});
		const withItem = await createUser("a@example.test");
		const eventOnly = await createUser("b@example.test");
		await registerForAgendaItem(item.id, withItem);
		await registerForEvent(eventId, eventOnly);

		const registrants = await getEventRegistrants(eventId);
		expect(registrants).toHaveLength(2);
		expect(registrants[0]).toMatchObject({
			userId: withItem,
			email: "a@example.test",
			agendaItemIds: [item.id],
		});
		expect(registrants[1]).toMatchObject({
			userId: eventOnly,
			agendaItemIds: [],
		});
	});
});

describe("validation errors map to specific codes", () => {
	it("end before start on a partial update → END_BEFORE_START", async () => {
		const eventId = await createEvent();
		const item = await createAgendaItem({
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		});
		expect(
			await rejectionCode(updateAgendaItem(item.id, { endsAt: hoursFromNow(23) })),
		).toBe("END_BEFORE_START");
	});

	it("unknown event → EVENT_NOT_FOUND", async () => {
		expect(
			await rejectionCode(
				createAgendaItem({
					eventId: "missing",
					title: "Lasers",
					startsAt: hoursFromNow(24),
					endsAt: hoursFromNow(25),
				}),
			),
		).toBe("EVENT_NOT_FOUND");
	});

	it("event limit below an item limit → ITEM_LIMIT_ABOVE_EVENT", async () => {
		const eventId = await createEvent({ maxSeats: 30 });
		await createAgendaItem({
			eventId,
			title: "Lasers",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
			maxSeats: 20,
		});
		expect(await rejectionCode(updateEvent({ id: eventId, maxSeats: 19 }))).toBe(
			"ITEM_LIMIT_ABOVE_EVENT",
		);
		await expect(updateEvent({ id: eventId, maxSeats: 20 })).resolves.toMatchObject({
			maxSeats: 20,
		});
	});
});

