import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	addEventFile,
	addEventMaterialLink,
	deleteEventFile,
	EVENT_FILES_LIMIT,
	EVENT_LINKS_LIMIT,
	forgetStoredFileDeletions,
	getEventFile,
	listEventFiles,
	recordStoredFileDeletion,
	removeEventMaterialLink,
	takeStoredFileDeletions,
} from "../src/queries/event-files";
import { getEventById } from "../src/queries/events";
import { agendaItems } from "../src/schema/agenda";
import { eventFiles } from "../src/schema/event-files";
import { events } from "../src/schema/events";
import { createEvent, createItem, rejectionCode, resetDb } from "./helpers";

beforeEach(async () => {
	await resetDb();
	await db.execute(sql`TRUNCATE stored_file_deletions`);
});

function file(eventId: string, name: string, agendaItemId?: string) {
	return addEventFile({
		eventId,
		agendaItemId,
		name,
		contentType: "application/pdf",
		size: 1234,
		storageKey: `events/${eventId}/${name}`,
	});
}

async function pendingKeys(): Promise<string[]> {
	return (await takeStoredFileDeletions(100)).sort();
}

describe("event files", () => {
	it("adds files and lists them oldest first", async () => {
		const eventId = await createEvent();
		const first = await file(eventId, "a.pdf");
		await file(eventId, "b.pdf");

		const listed = await listEventFiles(eventId);
		expect(listed.map((f) => f.name)).toEqual(["a.pdf", "b.pdf"]);
		expect(listed[0]).toMatchObject({ id: first.id, size: 1234, agendaItemId: null });
		expect(await getEventFile(first.id)).toMatchObject({
			eventId,
			storageKey: `events/${eventId}/a.pdf`,
			contentType: "application/pdf",
		});
	});

	it(`refuses more than ${EVENT_FILES_LIMIT} files per event`, async () => {
		const eventId = await createEvent();
		await db.insert(eventFiles).values(
			Array.from({ length: EVENT_FILES_LIMIT }, (_, i) => ({
				eventId,
				name: `${i}.pdf`,
				contentType: "application/pdf",
				size: 1,
				storageKey: `events/${eventId}/${i}`,
			})),
		);
		expect(await rejectionCode(file(eventId, "one-more.pdf"))).toBe("EVENT_FILES_LIMIT");
	});

	it("attaches a file to a programme item of the same event only", async () => {
		const eventId = await createEvent();
		const otherEvent = await createEvent();
		const itemId = await createItem(eventId);
		const foreignItem = await createItem(otherEvent);

		expect((await file(eventId, "slides.pdf", itemId)).agendaItemId).toBe(itemId);
		expect(await rejectionCode(file(eventId, "x.pdf", foreignItem))).toBe("ITEM_NOT_FOUND");
	});

	it("deletes a file only through its own event", async () => {
		const eventId = await createEvent();
		const otherEvent = await createEvent();
		const added = await file(eventId, "a.pdf");

		expect(await deleteEventFile(otherEvent, added.id)).toBeNull();
		expect(await listEventFiles(eventId)).toHaveLength(1);
		expect(await deleteEventFile(eventId, added.id)).toMatchObject({ id: added.id });
		expect(await listEventFiles(eventId)).toEqual([]);
	});
});

describe("stored file deletions", () => {
	it("records the key of every removed file, also through programme item and event deletion", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const single = await file(eventId, "single.pdf");
		await file(eventId, "item.pdf", itemId);
		await file(eventId, "event.pdf");

		await deleteEventFile(eventId, single.id);
		await db.delete(agendaItems).where(eq(agendaItems.id, itemId));
		await db.delete(events).where(eq(events.id, eventId));

		expect(await pendingKeys()).toEqual([
			`events/${eventId}/event.pdf`,
			`events/${eventId}/item.pdf`,
			`events/${eventId}/single.pdf`,
		]);
	});

	it("keeps keys until they are forgotten, and records keys directly", async () => {
		await recordStoredFileDeletion("events/x/1");
		await recordStoredFileDeletion("events/x/1");
		await recordStoredFileDeletion("events/x/2");

		expect(await takeStoredFileDeletions(1)).toHaveLength(1);
		expect(await pendingKeys()).toEqual(["events/x/1", "events/x/2"]);
		await forgetStoredFileDeletions(["events/x/1"]);
		expect(await pendingKeys()).toEqual(["events/x/2"]);
	});
});

function link(n: number) {
	return { label: `Link ${n}`, url: `https://example.com/${n}` };
}

async function storedLinks(eventId: string) {
	const [row] = await db
		.select({ materials: events.materials })
		.from(events)
		.where(eq(events.id, eventId));
	return row?.materials;
}

describe("material links", () => {
	it(`appends links and refuses more than ${EVENT_LINKS_LIMIT}`, async () => {
		const eventId = await createEvent();
		await addEventMaterialLink(eventId, link(1));
		await addEventMaterialLink(eventId, link(2));
		expect(await storedLinks(eventId)).toEqual([link(1), link(2)]);

		await db
			.update(events)
			.set({ materials: Array.from({ length: EVENT_LINKS_LIMIT }, (_, i) => link(i)) })
			.where(eq(events.id, eventId));
		expect(await rejectionCode(addEventMaterialLink(eventId, link(99)))).toBe(
			"EVENT_LINKS_LIMIT",
		);
		expect(await storedLinks(eventId)).toHaveLength(EVENT_LINKS_LIMIT);
	});

	it("keeps both links when two are added at once", async () => {
		const eventId = await createEvent();
		await Promise.all([
			addEventMaterialLink(eventId, link(1)),
			addEventMaterialLink(eventId, link(2)),
		]);
		const stored = await storedLinks(eventId);
		expect(stored).toHaveLength(2);
		expect(stored).toEqual(expect.arrayContaining([link(1), link(2)]));
	});

	it("removes a link only while its position still holds it", async () => {
		const eventId = await createEvent();
		for (const n of [1, 2, 1]) {
			await addEventMaterialLink(eventId, link(n));
		}

		expect(await removeEventMaterialLink(eventId, 0, link(2))).toBe(false);
		expect(await removeEventMaterialLink(eventId, 3, link(1))).toBe(false);
		expect(await storedLinks(eventId)).toEqual([link(1), link(2), link(1)]);

		expect(await removeEventMaterialLink(eventId, 2, link(1))).toBe(true);
		expect(await storedLinks(eventId)).toEqual([link(1), link(2)]);
		// Someone else removed the first link: the shown index 1 now holds nothing
		expect(await removeEventMaterialLink(eventId, 0, link(1))).toBe(true);
		expect(await removeEventMaterialLink(eventId, 1, link(2))).toBe(false);
		expect(await storedLinks(eventId)).toEqual([link(2)]);
	});
});

describe("material links and the event page", () => {
	it("stores links and gives them with the files on the event page", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		await addEventMaterialLink(eventId, { label: "Nagranie", url: "https://example.com/rec" });
		const added = await file(eventId, "slides.pdf", itemId);

		const event = await getEventById(eventId, { kind: "public", signedIn: true });
		expect(event?.materials).toEqual([{ label: "Nagranie", url: "https://example.com/rec" }]);
		expect(event?.files).toEqual([
			{ id: added.id, name: "slides.pdf", size: 1234, agendaItemId: itemId },
		]);
	});
});
