import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	type RegistrationChange,
	registerForAgendaItem,
	registerForEvent,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { updateEvent } from "../src/queries/events";
import { closeGroup, createGroup } from "../src/queries/groups";
import { eventRegistrations } from "../src/schema/event-registrations";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	readEventCount,
	rejectionCode,
	resetDb,
	stateOf,
	collectChanges,
} from "./helpers";

beforeEach(resetDb);

async function users(n: number) {
	return Promise.all(Array.from({ length: n }, () => createUser()));
}

describe("waitlist", () => {
	it("20 concurrent registrations for 5 seats give 5 registered and 15 waitlisted", async () => {
		const eventId = await createEvent({ maxSeats: 5 });
		const people = await users(20);
		const results = await Promise.all(people.map((u) => registerForEvent(eventId, u, "pl")));
		expect(results.filter((r) => r.state === "registered")).toHaveLength(5);
		expect(results.filter((r) => r.state === "waitlisted")).toHaveLength(15);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});

	it("concurrent withdrawals promote exactly as many, in waitlist order", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		const [a, b, c, w1, w2, w3] = await users(6);
		for (const u of [a, b, c, w1, w2, w3]) await registerForEvent(eventId, u ?? "", "pl");
		await Promise.all([unregisterFromEvent(eventId, a ?? ""), unregisterFromEvent(eventId, b ?? "")]);
		expect(await stateOf(eventId, w1 ?? "")).toBe("registered");
		expect(await stateOf(eventId, w2 ?? "")).toBe("registered");
		expect(await stateOf(eventId, w3 ?? "")).toBe("waitlisted");
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});

	it("re-registering after withdrawal joins the end of the waitlist", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, b, c] = await users(3);
		for (const u of [a, b, c]) await registerForEvent(eventId, u ?? "", "pl");
		await unregisterFromEvent(eventId, b ?? "");
		expect((await registerForEvent(eventId, b ?? "", "pl")).state).toBe("waitlisted");
		await unregisterFromEvent(eventId, a ?? "");
		expect(await stateOf(eventId, c ?? "")).toBe("registered");
		expect(await stateOf(eventId, b ?? "")).toBe("waitlisted");
	});

	it("raising max_seats by 2 promotes 2", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, w1, w2, w3] = await users(4);
		for (const u of [a, w1, w2, w3]) await registerForEvent(eventId, u ?? "", "pl");
		const { changes, hooks } = collectChanges();
		await updateEvent({ id: eventId, maxSeats: 3 }, hooks);
		expect(await stateOf(eventId, w1 ?? "")).toBe("registered");
		expect(await stateOf(eventId, w2 ?? "")).toBe("registered");
		expect(await stateOf(eventId, w3 ?? "")).toBe("waitlisted");
		expect(changes.map((c) => c.change)).toEqual(["promoted", "promoted"]);
	});

	it("closing a group promotes waitlisted people into released places", async () => {
		const eventId = await createEvent({ maxSeats: 3, date: hoursFromNow(24 * 10) });
		const [owner, a, w] = await users(3);
		const { groupId } = await createGroup({
			eventId,
			ownerUserId: owner ?? "",
			places: 2,
			itemIds: [],
			emails: [],
			joinLinkEnabled: false,
		});
		await registerForEvent(eventId, a ?? "", "pl");
		expect((await registerForEvent(eventId, w ?? "", "pl")).state).toBe("waitlisted");
		await closeGroup(groupId, owner ?? "");
		expect(await stateOf(eventId, w ?? "")).toBe("registered");
	});

	it("reports confirmed, waitlisted and promoted changes to the hook", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, b] = await users(2);
		const { changes, hooks } = collectChanges();
		await registerForEvent(eventId, a ?? "", "pl", hooks);
		await registerForEvent(eventId, b ?? "", "en", hooks);
		await unregisterFromEvent(eventId, a ?? "", hooks);
		expect(changes.map((c) => c.change)).toEqual(["confirmed", "waitlisted", "promoted"]);
	});

	it("a waitlisted person cannot register for an agenda item", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const itemId = await createItem(eventId, { maxSeats: 1 });
		const [a, b] = await users(2);
		await registerForEvent(eventId, a ?? "", "pl");
		await registerForEvent(eventId, b ?? "", "pl");
		expect(await rejectionCode(registerForAgendaItem(itemId, b ?? ""))).toBe("EVENT_WAITLISTED");
	});

	it("existing registration rows stay registered with unchanged counts", async () => {
		const eventId = await createEvent({ maxSeats: 2 });
		const u = await createUser();
		await db.insert(eventRegistrations).values({ id: crypto.randomUUID(), eventId, userId: u });
		const [row] = await db.select().from(eventRegistrations).where(eq(eventRegistrations.userId, u));
		expect(row?.state).toBe("registered");
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(1);
	});
});

describe("waitlist order under lock waits", () => {
	it("a registration that waited for the event lock queues after the one that held it", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, early, late] = await users(3);
		await registerForEvent(eventId, a ?? "", "pl");
		// `late` starts its transaction first, but inserts only after `early` has committed.
		let release: () => void = () => {};
		const lateMayInsert = new Promise<void>((resolve) => {
			release = resolve;
		});
		const lateInsert = db.transaction(async (tx) => {
			await tx.execute(sql`SELECT 1`);
			await lateMayInsert;
			await tx.insert(eventRegistrations).values({
				id: crypto.randomUUID(),
				eventId,
				userId: late ?? "",
				state: "waitlisted",
			});
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		await registerForEvent(eventId, early ?? "", "pl");
		release();
		await lateInsert;
		await unregisterFromEvent(eventId, a ?? "");
		expect(await stateOf(eventId, early ?? "")).toBe("registered");
		expect(await stateOf(eventId, late ?? "")).toBe("waitlisted");
	});
});

describe("ended events", () => {
	it("withdrawing from or raising the limit of an ended event promotes nobody", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const [a, w] = await users(2);
		await registerForEvent(eventId, a ?? "", "pl");
		await registerForEvent(eventId, w ?? "", "pl");
		const { events } = await import("../src/schema/events");
		await db
			.update(events)
			.set({ date: hoursFromNow(-48), endsAt: hoursFromNow(-47) })
			.where(eq(events.id, eventId));
		const { changes, hooks } = collectChanges();
		await updateEvent({ id: eventId, maxSeats: 2 }, hooks);
		await unregisterFromEvent(eventId, a ?? "", hooks);
		expect(await stateOf(eventId, w ?? "")).toBe("waitlisted");
		expect(changes).toEqual([]);
	});
});
