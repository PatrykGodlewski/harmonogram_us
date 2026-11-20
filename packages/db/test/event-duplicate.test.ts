import { asc, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { createAgendaItem } from "../src/queries/agenda-items";
import {
	addEventOrganizer,
	listEventOrganizers,
} from "../src/queries/event-organizers";
import { registerForEvent } from "../src/queries/event-registrations";
import { duplicateEvent } from "../src/queries/event-duplicate";
import { createEvent } from "../src/queries/events";
import { agendaItems } from "../src/schema/agenda";
import { eventRegistrations } from "../src/schema/event-registrations";
import { eventTypes } from "../src/schema/event-lookups";
import { events } from "../src/schema/events";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

/** 19 March 2027 10:00 in Warsaw is still winter time (UTC+1). */
const SOURCE = new Date("2027-03-19T09:00:00Z");
/** 2 April 2027 10:00 in Warsaw is summer time (UTC+2). */
const TARGET = new Date("2027-04-02T08:00:00Z");

async function sourceEvent(organizerId: string) {
	await db
		.insert(eventTypes)
		.values({ id: "t", slug: "t", label: "T" })
		.onConflictDoNothing();
	const event = await createEvent({
		title: "Seminarium",
		description: "Opis",
		date: SOURCE,
		endsAt: new Date("2027-03-19T13:00:00Z"),
		maxSeats: 7,
		groupDeadlineHours: 24,
		typeId: "t",
		organizerId,
		attendanceMode: "online",
		onlineUrl: "https://meet.example.test/s",
	});
	if (!event) throw new Error("no event");
	await db
		.update(events)
		.set({ status: "published", room: "B105" })
		.where(eq(events.id, event.id));
	await createAgendaItem({
		eventId: event.id,
		title: "Warsztat",
		startsAt: new Date("2027-03-19T10:00:00Z"),
		endsAt: new Date("2027-03-19T11:00:00Z"),
		maxSeats: 3,
	});
	return event.id;
}

describe("duplicateEvent", () => {
	it("copies the event as a draft at the new date, with the agenda at the same wall-clock times", async () => {
		const owner = await createUser();
		const sourceId = await sourceEvent(owner);

		const { id } = await duplicateEvent({
			eventId: sourceId,
			date: TARGET,
			actorId: owner,
		});

		const [copy] = await db.select().from(events).where(eq(events.id, id));
		expect(copy).toMatchObject({
			title: "Seminarium",
			description: "Opis",
			status: "draft",
			maxSeats: 7,
			groupDeadlineHours: 24,
			attendanceMode: "online",
			onlineUrl: "https://meet.example.test/s",
			room: "B105",
			date: TARGET,
			// 14:00 Warsaw stays 14:00 after the clock change.
			endsAt: new Date("2027-04-02T12:00:00Z"),
		});
		const items = await db
			.select()
			.from(agendaItems)
			.where(eq(agendaItems.eventId, id))
			.orderBy(asc(agendaItems.startsAt));
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			title: "Warsztat",
			maxSeats: 3,
			startsAt: new Date("2027-04-02T09:00:00Z"),
			endsAt: new Date("2027-04-02T10:00:00Z"),
		});
	});

	it("copies organizers plus the actor, but no registrations", async () => {
		const owner = await createUser();
		await createUser("co@x.test");
		const actor = await createUser();
		const sourceId = await sourceEvent(owner);
		await addEventOrganizer(sourceId, "co@x.test");
		await registerForEvent(sourceId, await createUser(), "pl");

		const { id } = await duplicateEvent({
			eventId: sourceId,
			date: TARGET,
			actorId: actor,
		});

		const organizers = await listEventOrganizers(id);
		expect(organizers.map((o) => o.userId).sort()).toEqual(
			[owner, actor, organizers.find((o) => o.email === "co@x.test")?.userId ?? ""].sort(),
		);
		const registrations = await db
			.select()
			.from(eventRegistrations)
			.where(eq(eventRegistrations.eventId, id));
		expect(registrations).toHaveLength(0);
	});

	it("keeps the approval and certificate settings", async () => {
		const helpers = await import("./helpers");
		const sourceId = await helpers.createEvent({ requiresApproval: true });
		await db
			.update(events)
			.set({ certificatesEnabled: true })
			.where(eq(events.id, sourceId));
		const actor = await createUser();
		const copy = await duplicateEvent({
			eventId: sourceId,
			date: new Date(Date.now() + 30 * 86_400_000),
			actorId: actor,
		});
		const [row] = await db.select().from(events).where(eq(events.id, copy.id));
		expect(row).toMatchObject({ requiresApproval: true, certificatesEnabled: true });
	});

	it("a missing source is 'event not found'", async () => {
		const actor = await createUser();
		await expect(
			duplicateEvent({ eventId: "missing", date: TARGET, actorId: actor }),
		).rejects.toMatchObject({ code: "EVENT_NOT_FOUND" });
	});
});

describe("recurring copies", () => {
	async function copiesOf(ids: string[]) {
		return db
			.select({ id: events.id, date: events.date })
			.from(events)
			.where(inArray(events.id, ids))
			.orderBy(asc(events.date));
	}

	it("weekly copies keep 10:00 local time across the change to summer time", async () => {
		const actor = await createUser();
		const sourceId = await sourceEvent(actor);
		const { ids } = await duplicateEvent({
			eventId: sourceId,
			date: new Date("2027-03-19T09:00:00Z"),
			repeat: "weekly",
			count: 3,
			actorId: actor,
		});
		expect((await copiesOf(ids)).map((copy) => copy.date.toISOString())).toEqual([
			"2027-03-19T09:00:00.000Z",
			"2027-03-26T09:00:00.000Z",
			"2027-04-02T08:00:00.000Z",
		]);
	});

	it("monthly copies from the 31st land on each month's last day", async () => {
		const actor = await createUser();
		const sourceId = await sourceEvent(actor);
		const { ids } = await duplicateEvent({
			eventId: sourceId,
			date: new Date("2027-01-31T09:00:00Z"),
			repeat: "monthly",
			count: 3,
			actorId: actor,
		});
		expect((await copiesOf(ids)).map((copy) => copy.date.toISOString())).toEqual([
			"2027-01-31T09:00:00.000Z",
			"2027-02-28T09:00:00.000Z",
			"2027-03-31T08:00:00.000Z",
		]);
	});

	it("copies only what was chosen", async () => {
		const actor = await createUser();
		const sourceId = await sourceEvent(actor);
		await createUser("other@x.test");
		await addEventOrganizer(sourceId, "other@x.test");
		const { ids } = await duplicateEvent({
			eventId: sourceId,
			date: TARGET,
			copy: { agenda: false, organizers: false },
			actorId: actor,
		});
		const [id] = ids;
		const items = await db.select().from(agendaItems).where(eq(agendaItems.eventId, id ?? ""));
		expect(items).toHaveLength(0);
		expect((await listEventOrganizers(id ?? "")).map((o) => o.userId)).toEqual([actor]);
	});
});
