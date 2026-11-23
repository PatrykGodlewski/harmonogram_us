import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	createAgendaItem,
	listAgendaItems,
	updateAgendaItem,
} from "../src/queries/agenda-items";
import {
	copyAgendaSession,
	createAgendaSession,
	deleteAgendaSession,
	listAgendaSessions,
	updateAgendaSession,
} from "../src/queries/agenda-sessions";
import { registerForAgendaItem } from "../src/queries/event-registrations";
import { agendaItems } from "../src/schema/agenda";
import { eventLocations } from "../src/schema/event-lookups";
import { createEvent, createUser, rejectionCode, resetDb } from "./helpers";

beforeEach(async () => {
	await resetDb();
	await db.insert(eventLocations).values([
		{ id: "lab-101", slug: "lab-101", label: "Lab 101" },
		{ id: "lab-205", slug: "lab-205", label: "Lab 205" },
		{ id: "aula", slug: "aula", label: "Aula" },
	]);
});

const at = (iso: string) => new Date(iso);
const HOUR = 3_600_000;

/** „Ćwiczenia” in Lab 101, 10:00–12:00 Warsaw (summer time) on 30.10.2027, with two items. */
async function exercises() {
	const eventId = await createEvent({
		date: at("2027-10-30T07:00:00Z"),
		maxSeats: 50,
	});
	const session = await createAgendaSession({
		eventId,
		title: "Ćwiczenia",
		description: "Zajęcia praktyczne",
		color: "green",
		locationId: "lab-101",
		startsAt: at("2027-10-30T08:00:00Z"),
		endsAt: at("2027-10-30T10:00:00Z"),
	});
	const microscopes = await createAgendaItem({
		eventId,
		sessionId: session.id,
		title: "Mikroskopy",
		startsAt: at("2027-10-30T08:00:00Z"),
		endsAt: at("2027-10-30T08:50:00Z"),
		locationId: "lab-101",
		maxSeats: 12,
		speakers: [{ name: "dr Anna Nowak" }],
		materials: [{ label: "Instrukcja", url: "https://example.test/i.pdf" }],
	});
	const measurements = await createAgendaItem({
		eventId,
		sessionId: session.id,
		title: "Pomiary",
		startsAt: at("2027-10-30T09:00:00Z"),
		endsAt: at("2027-10-30T09:50:00Z"),
		locationId: "aula",
	});
	return { eventId, session, microscopes, measurements };
}

describe("agenda sessions", () => {
	it("lists an event's sessions by start, with their location", async () => {
		const { eventId, session } = await exercises();
		const lectures = await createAgendaSession({
			eventId,
			title: "Wykłady",
			startsAt: at("2027-10-30T07:00:00Z"),
			endsAt: at("2027-10-30T11:00:00Z"),
		});
		const sessions = await listAgendaSessions(eventId);
		expect(sessions.map((row) => row.id)).toEqual([lectures.id, session.id]);
		expect(sessions[1]).toMatchObject({
			title: "Ćwiczenia",
			color: "green",
			locationLabel: "Lab 101",
		});
		expect(sessions[0]).toMatchObject({ color: "blue", locationId: null });
		expect((await listAgendaItems(eventId))[0]?.sessionId).toBe(session.id);
	});

	it("keeps a session's items inside its times", async () => {
		const { eventId, session, microscopes } = await exercises();
		expect(
			await rejectionCode(
				createAgendaItem({
					eventId,
					sessionId: session.id,
					title: "Za późno",
					startsAt: at("2027-10-30T09:30:00Z"),
					endsAt: at("2027-10-30T10:30:00Z"),
				}),
			),
		).toBe("ITEM_OUTSIDE_SESSION");
		expect(
			await rejectionCode(
				updateAgendaItem(microscopes.id, {
					startsAt: at("2027-10-30T07:30:00Z"),
				}),
			),
		).toBe("ITEM_OUTSIDE_SESSION");
		expect(
			await rejectionCode(
				updateAgendaSession(session.id, {
					endsAt: at("2027-10-30T09:30:00Z"),
				}),
			),
		).toBe("SESSION_ITEMS_OUTSIDE");
		const longer = await updateAgendaSession(session.id, {
			endsAt: at("2027-10-30T11:00:00Z"),
			title: "Ćwiczenia A",
		});
		expect(longer).toMatchObject({ title: "Ćwiczenia A" });
	});

	it("moving a session moves its programme with it; shrinking it past an item is refused", async () => {
		const { eventId, session } = await exercises();
		// 10:00–12:00 becomes 14:00–16:00 the next day
		const moved = await updateAgendaSession(session.id, {
			startsAt: at("2027-10-31T13:00:00Z"),
			endsAt: at("2027-10-31T15:00:00Z"),
		});
		expect(moved).toMatchObject({ startsAt: at("2027-10-31T13:00:00Z") });
		const items = await listAgendaItems(eventId);
		expect(items.map((item) => [item.title, item.startsAt, item.endsAt])).toEqual([
			["Mikroskopy", at("2027-10-31T13:00:00Z"), at("2027-10-31T13:50:00Z")],
			["Pomiary", at("2027-10-31T14:00:00Z"), at("2027-10-31T14:50:00Z")],
		]);
		// A later start with the same end would squeeze the last item out
		expect(
			await rejectionCode(
				updateAgendaSession(session.id, { startsAt: at("2027-10-31T13:30:00Z") }),
			),
		).toBe("SESSION_ITEMS_OUTSIDE");
	});

	it("refuses a session of another event", async () => {
		const { session } = await exercises();
		const otherEvent = await createEvent();
		expect(
			await rejectionCode(
				createAgendaItem({
					eventId: otherEvent,
					sessionId: session.id,
					title: "Obcy",
					startsAt: at("2027-10-30T08:00:00Z"),
					endsAt: at("2027-10-30T08:30:00Z"),
				}),
			),
		).toBe("SESSION_NOT_FOUND");
	});

	it("deleting a session deletes its programme", async () => {
		const { eventId, session } = await exercises();
		const opening = await createAgendaItem({
			eventId,
			title: "Otwarcie",
			startsAt: at("2027-10-30T07:00:00Z"),
			endsAt: at("2027-10-30T07:30:00Z"),
		});
		expect(await deleteAgendaSession(session.id)).toEqual({ id: session.id });
		expect((await listAgendaItems(eventId)).map((item) => item.id)).toEqual([
			opening.id,
		]);
		expect(await listAgendaSessions(eventId)).toEqual([]);
	});

	it("a copy starts elsewhere with the same programme, independent of the source", async () => {
		const { eventId, session, microscopes } = await exercises();
		await registerForAgendaItem(microscopes.id, await createUser());
		// Same day, 13:00 in Lab 205
		const copy = await copyAgendaSession(session.id, {
			startsAt: at("2027-10-30T11:00:00Z"),
			locationId: "lab-205",
		});
		expect(copy).toMatchObject({
			title: "Ćwiczenia",
			description: "Zajęcia praktyczne",
			color: "green",
			locationId: "lab-205",
			startsAt: at("2027-10-30T11:00:00Z"),
			endsAt: at("2027-10-30T13:00:00Z"),
		});
		const copied = (await listAgendaItems(eventId)).filter(
			(item) => item.sessionId === copy.id,
		);
		expect(copied.map((item) => [item.title, item.startsAt, item.endsAt])).toEqual([
			["Mikroskopy", at("2027-10-30T11:00:00Z"), at("2027-10-30T11:50:00Z")],
			["Pomiary", at("2027-10-30T12:00:00Z"), at("2027-10-30T12:50:00Z")],
		]);
		// Items in the session's location move with it; others keep theirs
		expect(copied.map((item) => item.locationId)).toEqual(["lab-205", "aula"]);
		expect(copied[0]).toMatchObject({
			maxSeats: 12,
			speakers: [{ name: "dr Anna Nowak" }],
			materials: [{ label: "Instrukcja", url: "https://example.test/i.pdf" }],
			registeredCount: 0,
		});
		// Editing the copy leaves the source as it was
		await updateAgendaItem(copied[0]?.id ?? "", { title: "Mikroskopy (B)" });
		const [source] = await db
			.select({ title: agendaItems.title })
			.from(agendaItems)
			.where(eq(agendaItems.id, microscopes.id));
		expect(source?.title).toBe("Mikroskopy");
	});

	it("a copy can get its own title and keeps the source's location when none is given", async () => {
		const { session } = await exercises();
		const copy = await copyAgendaSession(session.id, {
			startsAt: at("2027-10-31T08:00:00Z"),
			title: "Ćwiczenia (2)",
		});
		expect(copy).toMatchObject({ title: "Ćwiczenia (2)", locationId: "lab-101" });
	});

	it("a copy after the change to winter time keeps the programme's wall-clock spacing", async () => {
		const { eventId, session } = await exercises();
		// 1.11 13:00 Warsaw is 12:00 UTC (winter time); the source ran in summer time
		const copy = await copyAgendaSession(session.id, {
			startsAt: at("2027-11-01T12:00:00Z"),
		});
		const copied = (await listAgendaItems(eventId)).filter(
			(item) => item.sessionId === copy.id,
		);
		expect(copied.map((item) => item.startsAt)).toEqual([
			at("2027-11-01T12:00:00Z"),
			new Date(at("2027-11-01T12:00:00Z").getTime() + HOUR),
		]);
	});

	it("refuses to copy an unknown session", async () => {
		expect(
			await rejectionCode(
				copyAgendaSession("missing", { startsAt: at("2027-11-01T12:00:00Z") }),
			),
		).toBe("SESSION_NOT_FOUND");
	});
});
