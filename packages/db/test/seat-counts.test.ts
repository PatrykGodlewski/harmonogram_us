import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { agendaItemRegistrations, agendaItems } from "../src/schema/agenda";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import {
	createEvent,
	createItem,
	createUser,
	expectConstraintViolation,
	readEventCount,
	readItemCount,
	resetDb,
} from "./helpers";

async function registerEvent(eventId: string, userId: string) {
	const id = crypto.randomUUID();
	await db.insert(eventRegistrations).values({ id, eventId, userId });
	return id;
}

async function registerItem(
	itemId: string,
	eventRegistrationId: string,
	userId: string,
) {
	await db.insert(agendaItemRegistrations).values({
		id: crypto.randomUUID(),
		agendaItemId: itemId,
		eventRegistrationId,
		userId,
	});
}

beforeEach(resetDb);

describe("event seat counts", () => {
	it("event insert creates count row", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		expect(await readEventCount(eventId)).toEqual({
			maxSeats: 3,
			seatsRemaining: 3,
		});
	});

	it("event registration insert/delete updates count", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		const first = await registerEvent(eventId, await createUser());
		await registerEvent(eventId, await createUser());
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(1);

		await db.delete(eventRegistrations).where(eq(eventRegistrations.id, first));
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(2);
	});

	it("event max_seats update recomputes", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		await registerEvent(eventId, await createUser());
		await db.update(events).set({ maxSeats: 5 }).where(eq(events.id, eventId));
		expect(await readEventCount(eventId)).toEqual({
			maxSeats: 5,
			seatsRemaining: 4,
		});
	});

	it("lowering max_seats below registered fails with named constraint", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		await registerEvent(eventId, await createUser());
		await registerEvent(eventId, await createUser());
		await expectConstraintViolation(
			db.update(events).set({ maxSeats: 1 }).where(eq(events.id, eventId)),
			"event_seat_counts_seats_remaining_nonnegative",
		);
	});
});

describe("agenda item seat counts", () => {
	it("item insert creates count row; unlimited item has null remaining", async () => {
		const eventId = await createEvent();
		const limited = await createItem(eventId, { maxSeats: 10 });
		const unlimited = await createItem(eventId, { maxSeats: null });

		expect(await readItemCount(limited)).toEqual({
			maxSeats: 10,
			seatsRemaining: 10,
			registeredCount: 0,
		});
		expect(await readItemCount(unlimited)).toEqual({
			maxSeats: null,
			seatsRemaining: null,
			registeredCount: 0,
		});
	});

	it("item registration updates count", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 10 });
		const userId = await createUser();
		await registerItem(itemId, await registerEvent(eventId, userId), userId);

		expect(await readItemCount(itemId)).toMatchObject({
			seatsRemaining: 9,
			registeredCount: 1,
		});
	});

	it("item capacity toggles to unlimited and back", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 10 });
		const userId = await createUser();
		await registerItem(itemId, await registerEvent(eventId, userId), userId);

		await db
			.update(agendaItems)
			.set({ maxSeats: null })
			.where(eq(agendaItems.id, itemId));
		expect(await readItemCount(itemId)).toEqual({
			maxSeats: null,
			seatsRemaining: null,
			registeredCount: 1,
		});

		await db
			.update(agendaItems)
			.set({ maxSeats: 4 })
			.where(eq(agendaItems.id, itemId));
		expect(await readItemCount(itemId)).toEqual({
			maxSeats: 4,
			seatsRemaining: 3,
			registeredCount: 1,
		});
	});

	it("deleting event registration cascades item registrations", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const userId = await createUser();
		const registrationId = await registerEvent(eventId, userId);
		await registerItem(itemId, registrationId, userId);

		await db
			.delete(eventRegistrations)
			.where(eq(eventRegistrations.id, registrationId));
		expect((await readItemCount(itemId))?.registeredCount).toBe(0);
	});

	it("deleting event cascades without errors", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const userId = await createUser();
		await registerItem(itemId, await registerEvent(eventId, userId), userId);

		await db.delete(events).where(eq(events.id, eventId));
		expect(await readEventCount(eventId)).toBeUndefined();
		expect(await readItemCount(itemId)).toBeUndefined();
	});

	it("ends_at must be after starts_at", async () => {
		const eventId = await createEvent();
		const startsAt = new Date("2026-12-01T10:00:00Z");
		await expectConstraintViolation(
			createItem(eventId, { startsAt, endsAt: startsAt }),
			"agenda_items_ends_after_starts",
		);
	});
});
