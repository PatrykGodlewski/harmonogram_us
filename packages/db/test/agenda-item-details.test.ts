import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	createAgendaItem,
	deleteAgendaItem,
	listAgendaItems,
	setAgendaItemImage,
	updateAgendaItem,
} from "../src/queries/agenda-items";
import {
	copyAgendaSession,
	createAgendaSession,
} from "../src/queries/agenda-sessions";
import { duplicateEvent } from "../src/queries/event-duplicate";
import { takeStoredFileDeletions } from "../src/queries/event-files";
import { eventFaculties, eventTypes } from "../src/schema/event-lookups";
import { events } from "../src/schema/events";
import { createEvent, createUser, hoursFromNow, resetDb } from "./helpers";

beforeEach(async () => {
	await resetDb();
	await db.execute(sql`TRUNCATE stored_file_deletions`);
});

const details = {
	typeId: "lecture",
	facultyId: "art",
	topic: "Sztuka",
	audience: "dla wszystkich",
	languages: ["pl", "en"],
	speakers: [
		{
			name: "dr hab. Anna Kijanowska",
			affiliation: "Uniwersytet Śląski w Katowicach",
			unit: "Wydział Sztuki i Nauk o Edukacji",
			bio: "Pianistka, badaczka i pedagożka.",
		},
	],
};

async function seedLookups() {
	await db
		.insert(eventTypes)
		.values({ id: "lecture", slug: "lecture", label: "Wykład" });
	await db
		.insert(eventFaculties)
		.values({ id: "art", slug: "art", label: "Wydział Sztuki" });
}

describe("programme item details", () => {
	it("stores and lists the category, unit, field, audience, languages and speaker bios", async () => {
		await seedLookups();
		const eventId = await createEvent();
		await createAgendaItem({
			eventId,
			title: "W cieniu sławy",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
			...details,
		});

		const [item] = await listAgendaItems(eventId);
		expect(item).toMatchObject({
			...details,
			typeLabel: "Wykład",
			facultyLabel: "Wydział Sztuki",
			hasImage: false,
			imageAlt: null,
		});
	});

	it("an item without details has empty ones", async () => {
		const eventId = await createEvent();
		await createAgendaItem({
			eventId,
			title: "Przerwa",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		});
		const [item] = await listAgendaItems(eventId);
		expect(item).toMatchObject({
			typeId: null,
			typeLabel: null,
			facultyId: null,
			topic: null,
			audience: null,
			languages: [],
		});
	});

	it("a replaced, removed or deleted image is queued for deletion", async () => {
		const eventId = await createEvent();
		const item = await createAgendaItem({
			eventId,
			title: "Z obrazem",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		});

		await setAgendaItemImage(item.id, { key: "items/a", alt: "Fortepian" });
		const [withImage] = await listAgendaItems(eventId);
		expect(withImage).toMatchObject({ hasImage: true, imageAlt: "Fortepian" });
		// Editing other fields keeps the image.
		await updateAgendaItem(item.id, { title: "Nowy tytuł" });
		expect(await takeStoredFileDeletions(10)).toEqual([]);

		await setAgendaItemImage(item.id, { key: "items/b", alt: "Scena" });
		expect(await takeStoredFileDeletions(10)).toEqual(["items/a"]);
		await setAgendaItemImage(item.id, null);
		expect(await takeStoredFileDeletions(10)).toEqual(["items/a", "items/b"]);

		await setAgendaItemImage(item.id, { key: "items/c", alt: "Sala" });
		await deleteAgendaItem(item.id);
		expect(await takeStoredFileDeletions(10)).toContain("items/c");
	});

	it("deleting the event queues its items' images", async () => {
		const eventId = await createEvent();
		const item = await createAgendaItem({
			eventId,
			title: "Z obrazem",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
		});
		await setAgendaItemImage(item.id, { key: "items/d", alt: "Sala" });
		await db.delete(events).where(eq(events.id, eventId));
		expect(await takeStoredFileDeletions(10)).toEqual(["items/d"]);
	});

	it("duplicating an event or copying a session keeps the details, not the image", async () => {
		await seedLookups();
		const eventId = await createEvent();
		const session = await createAgendaSession({
			eventId,
			title: "Sesja",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(28),
		});
		const item = await createAgendaItem({
			eventId,
			sessionId: session.id,
			title: "W cieniu sławy",
			startsAt: hoursFromNow(24),
			endsAt: hoursFromNow(25),
			...details,
		});
		await setAgendaItemImage(item.id, { key: "items/e", alt: "Sala" });

		const copy = await duplicateEvent({
			eventId,
			date: hoursFromNow(24 * 30),
			actorId: await createUser(),
		});
		const [duplicated] = await listAgendaItems(copy.id);
		expect(duplicated).toMatchObject({ ...details, hasImage: false });

		await copyAgendaSession(session.id, { startsAt: hoursFromNow(48) });
		const copied = (await listAgendaItems(eventId)).find(
			(entry) => entry.id !== item.id,
		);
		expect(copied).toMatchObject({ ...details, hasImage: false });
	});
});
