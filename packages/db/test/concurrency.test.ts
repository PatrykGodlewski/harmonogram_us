import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	registerForAgendaItem,
	registerForEvent,
	unregisterFromAgendaItem,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import { agendaItemRegistrations, agendaItems } from "../src/schema/agenda";
import { events } from "../src/schema/events";
import { eventRegistrations } from "../src/schema/event-registrations";
import {
	createEvent,
	createItem,
	createUser,
	readEventCount,
	readItemCount,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens a transaction that runs `work`, then holds it open until `release()` is called. */
function holdTransaction(work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>) {
	let release!: () => void;
	const released = new Promise<void>((r) => {
		release = r;
	});
	let ready!: () => void;
	const isReady = new Promise<void>((r) => {
		ready = r;
	});
	const done = db.transaction(async (tx) => {
		await work(tx);
		ready();
		await released;
	});
	return { isReady, release, done };
}

async function actualEventRegistrations(eventId: string) {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.eventId, eventId));
	return row?.n ?? 0;
}

async function actualItemRegistrations(itemId: string) {
	const [row] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(agendaItemRegistrations)
		.where(eq(agendaItemRegistrations.agendaItemId, itemId));
	return row?.n ?? 0;
}

describe("seat counts stay exact under concurrent writes", () => {
	it("raw writers: open delete + concurrent insert keeps the event count exact", async () => {
		const eventId = await createEvent({ maxSeats: 2 });
		const [u1, u2] = [await createUser(), await createUser()];
		await registerForEvent(eventId, u1);

		const deletion = holdTransaction(async (tx) => {
			await tx
				.delete(eventRegistrations)
				.where(eq(eventRegistrations.userId, u1));
		});
		await deletion.isReady;
		const insert = db
			.insert(eventRegistrations)
			.values({ id: crypto.randomUUID(), eventId, userId: u2 })
			.execute();
		await sleep(300);
		deletion.release();
		await Promise.all([deletion.done, insert]);

		const actual = await actualEventRegistrations(eventId);
		expect(actual).toBe(1);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(2 - actual);
	});

	it("raw writers: open delete + concurrent insert keeps the item count exact", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId, { maxSeats: 5 });
		const [u1, u2] = [await createUser(), await createUser()];
		await registerForAgendaItem(itemId, u1);
		await registerForEvent(eventId, u2);
		const [u2Registration] = await db
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(eq(eventRegistrations.userId, u2));

		const deletion = holdTransaction(async (tx) => {
			await tx
				.delete(agendaItemRegistrations)
				.where(eq(agendaItemRegistrations.userId, u1));
		});
		await deletion.isReady;
		const insert = db.insert(agendaItemRegistrations).values({
			id: crypto.randomUUID(),
			agendaItemId: itemId,
			eventRegistrationId: u2Registration?.id ?? "",
			userId: u2,
		}).execute();
		await sleep(300);
		deletion.release();
		await Promise.all([deletion.done, insert]);

		const actual = await actualItemRegistrations(itemId);
		expect(actual).toBe(1);
		expect(await readItemCount(itemId)).toMatchObject({
			registeredCount: actual,
			seatsRemaining: 5 - actual,
		});
	});

	it("app: unregister racing a register never leaves the event falsely full", async () => {
		const eventId = await createEvent({ maxSeats: 2 });
		const itemId = await createItem(eventId, { maxSeats: 2 });
		const [u1, u2, u3] = [await createUser(), await createUser(), await createUser()];
		await registerForAgendaItem(itemId, u1);

		const results = await Promise.allSettled([
			unregisterFromEvent(eventId, u1),
			registerForAgendaItem(itemId, u2),
			unregisterFromAgendaItem(itemId, u2).catch(() => undefined),
		]);
		expect(results.every((r) => r.status === "fulfilled")).toBe(true);

		const eventActual = await actualEventRegistrations(eventId);
		const itemActual = await actualItemRegistrations(itemId);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(2 - eventActual);
		expect((await readItemCount(itemId))?.registeredCount).toBe(itemActual);
		await expect(registerForEvent(eventId, u3)).resolves.toHaveProperty("txid");
	});

	it("app: unregister-from-event and new item registrations don't deadlock", async () => {
		const eventId = await createEvent({ maxSeats: 100 });
		const itemId = await createItem(eventId, { maxSeats: 100 });
		const leaving = await Promise.all(
			Array.from({ length: 15 }, () => createUser()),
		);
		for (const userId of leaving) {
			await registerForAgendaItem(itemId, userId);
		}
		const joining = await Promise.all(
			Array.from({ length: 15 }, () => createUser()),
		);

		const results = await Promise.allSettled(
			leaving.flatMap((userId, index) => [
				unregisterFromEvent(eventId, userId),
				registerForAgendaItem(itemId, joining[index] ?? ""),
			]),
		);
		const failures = results
			.filter((r): r is PromiseRejectedResult => r.status === "rejected")
			.map((r) => String(r.reason?.cause?.code ?? r.reason?.code ?? r.reason));
		expect(failures).toEqual([]);
		expect((await readItemCount(itemId))?.registeredCount).toBe(15);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(85);
	});

	it("app: unregister-from-event waits for an in-flight item registration instead of deadlocking", async () => {
		const eventId = await createEvent({ maxSeats: 10 });
		const itemId = await createItem(eventId, { maxSeats: 10 });
		const [leaving, joining] = [await createUser(), await createUser()];
		await registerForAgendaItem(itemId, leaving);

		// Same lock sequence as registerForAgendaItem, paused after the event registration insert.
		let release!: () => void;
		const released = new Promise<void>((r) => {
			release = r;
		});
		let ready!: () => void;
		const isReady = new Promise<void>((r) => {
			ready = r;
		});
		const registration = db.transaction(async (tx) => {
			await tx.select().from(agendaItems).where(eq(agendaItems.id, itemId)).for("update");
			await tx.select().from(events).where(eq(events.id, eventId)).for("update");
			const eventRegistrationId = crypto.randomUUID();
			await tx
				.insert(eventRegistrations)
				.values({ id: eventRegistrationId, eventId, userId: joining });
			ready();
			await released;
			await tx.insert(agendaItemRegistrations).values({
				id: crypto.randomUUID(),
				agendaItemId: itemId,
				eventRegistrationId,
				userId: joining,
			});
		});
		await isReady;
		const unregister = unregisterFromEvent(eventId, leaving);
		await sleep(300);
		release();

		const results = await Promise.allSettled([registration, unregister]);
		const failures = results
			.filter((r): r is PromiseRejectedResult => r.status === "rejected")
			.map((r) => String(r.reason?.cause?.code ?? r.reason?.code ?? r.reason));
		expect(failures).toEqual([]);
		expect((await readItemCount(itemId))?.registeredCount).toBe(1);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(9);
	});

	it("item registration and a transaction holding the event never deadlock (global lock order: event first)", async () => {
		const eventId = await createEvent({ maxSeats: 10 });
		const itemId = await createItem(eventId, { maxSeats: 10 });
		const [holder, registrant] = [await createUser(), await createUser()];
		const holderRegistrationId = crypto.randomUUID();
		await db.insert(eventRegistrations).values({ id: holderRegistrationId, eventId, userId: holder });

		// Like acceptInvitation: lock the event, then insert an item registration (FK key-share on the item).
		let release!: () => void;
		const released = new Promise<void>((r) => {
			release = r;
		});
		let ready!: () => void;
		const isReady = new Promise<void>((r) => {
			ready = r;
		});
		const holderTx = db.transaction(async (tx) => {
			await tx.select().from(events).where(eq(events.id, eventId)).for("update");
			ready();
			await released;
			await tx.insert(agendaItemRegistrations).values({
				id: crypto.randomUUID(),
				agendaItemId: itemId,
				eventRegistrationId: holderRegistrationId,
				userId: holder,
			});
		});
		await isReady;
		const registration = registerForAgendaItem(itemId, registrant);
		await sleep(300);
		release();

		const results = await Promise.allSettled([holderTx, registration]);
		const failures = results
			.filter((r): r is PromiseRejectedResult => r.status === "rejected")
			.map((r) => String(r.reason?.cause?.code ?? r.reason?.code ?? r.reason));
		expect(failures).toEqual([]);
	});
});

