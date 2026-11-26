import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { listEventFiles, takeStoredFileDeletions } from "@repo/db/queries/event-files";
import { eventFiles } from "@repo/db/schema/event-files";
import { events } from "@repo/db/schema/events";
import { createEvent, createItem, rejectionCode, resetDb } from "../../db/test/helpers";
import { type StoreFileDeps, storeEventFile } from "../src/files/store";
import type { StorageConfig } from "../src/storage/s3";

const CONFIG: StorageConfig = {
	endpoint: "https://s3.example",
	bucket: "files",
	accessKeyId: "k",
	secretAccessKey: "s",
	region: "auto",
};

beforeEach(async () => {
	await resetDb();
	await db.execute(sql`TRUNCATE stored_file_deletions`);
});

/** A cutoff after every key recorded so far. */
const later = () => new Date(Date.now() + 60_000);
const pendingKeys = () => takeStoredFileDeletions(10, later());

function fakeStorage(opts: { failDelete?: boolean; onPut?: (key: string) => Promise<void> } = {}) {
	const objects = new Map<string, { bytes: ArrayBuffer; type: string }>();
	const puts: string[] = [];
	const deps: StoreFileDeps = {
		config: CONFIG,
		put: async (_config, key, bytes, type) => {
			puts.push(key);
			await opts.onPut?.(key);
			objects.set(key, { bytes, type });
		},
		remove: async (_config, key) => {
			if (opts.failDelete) throw new Error("Storage DELETE failed: HTTP 500");
			objects.delete(key);
		},
	};
	return { objects, puts, deps };
}

const pdf = (name = "Slajdy.pdf", bytes = 3) => new File([new Uint8Array(bytes)], name);

describe("storeEventFile", () => {
	it("stores the bytes under an app-made key with the server's type, then the row", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const { objects, deps } = fakeStorage();

		const stored = await storeEventFile({ eventId, agendaItemId: itemId, file: pdf("../Slajdy.PDF") }, deps);

		expect(stored).toMatchObject({ name: "Slajdy.PDF", size: 3, agendaItemId: itemId });
		const [key] = [...objects.keys()];
		expect(key).toMatch(new RegExp(`^events/${eventId}/[0-9a-f-]{36}$`));
		expect(objects.get(key ?? "")?.type).toBe("application/pdf");
		expect(await listEventFiles(eventId)).toHaveLength(1);
	});

	it("refuses disallowed, oversized, empty-named files and full events before storing anything", async () => {
		const eventId = await createEvent();
		const { objects, deps } = fakeStorage();
		const big = { name: "big.pdf", size: 25 * 1024 * 1024 + 1 } as unknown as File;

		expect(await rejectionCode(storeEventFile({ eventId, file: pdf("x.html") }, deps))).toBe("FILE_TYPE");
		expect(await rejectionCode(storeEventFile({ eventId, file: pdf("/") }, deps))).toBe("FILE_TYPE");
		expect(await rejectionCode(storeEventFile({ eventId, file: big }, deps))).toBe("FILE_TOO_LARGE");
		await db.insert(eventFiles).values(
			Array.from({ length: 50 }, (_, i) => ({
				eventId,
				name: `${i}.pdf`,
				contentType: "application/pdf",
				size: 1,
				storageKey: `events/${eventId}/${i}`,
			})),
		);
		expect(await rejectionCode(storeEventFile({ eventId, file: pdf() }, deps))).toBe("EVENT_FILES_LIMIT");
		expect(objects.size).toBe(0);
	});

	it("is off without storage", async () => {
		const eventId = await createEvent();
		const { deps } = fakeStorage();
		expect(await rejectionCode(storeEventFile({ eventId, file: pdf() }, { ...deps, config: null }))).toBe(
			"FILES_NOT_CONFIGURED",
		);
	});

	it("records the key before storing and forgets it with the row", async () => {
		const eventId = await createEvent();
		const recordedAtPut: string[][] = [];
		const { objects, deps } = fakeStorage({
			onPut: async () => {
				recordedAtPut.push(await pendingKeys());
			},
		});

		await storeEventFile({ eventId, file: pdf() }, deps);

		expect(recordedAtPut).toEqual([[...objects.keys()]]);
		expect(await pendingKeys()).toEqual([]);
	});

	it("refuses another event's programme item before storing anything", async () => {
		const eventId = await createEvent();
		const foreignItem = await createItem(await createEvent());
		const { puts, deps } = fakeStorage();

		expect(
			await rejectionCode(storeEventFile({ eventId, agendaItemId: foreignItem, file: pdf() }, deps)),
		).toBe("ITEM_NOT_FOUND");
		expect(puts).toEqual([]);
		expect(await pendingKeys()).toEqual([]);
	});

	it("removes the object when the row cannot be added, or leaves its key for the clean-up", async () => {
		// The event is deleted between the checks and the insert.
		const deleteEvent = (eventId: string) => async () => {
			await db.delete(events).where(eq(events.id, eventId));
		};
		const gone = await createEvent();
		const ok = fakeStorage({ onPut: deleteEvent(gone) });
		await expect(storeEventFile({ eventId: gone, file: pdf() }, ok.deps)).rejects.toThrow();
		expect(ok.objects.size).toBe(0);
		expect(await pendingKeys()).toEqual([]);

		const goneToo = await createEvent();
		const failing = fakeStorage({ failDelete: true, onPut: deleteEvent(goneToo) });
		await expect(storeEventFile({ eventId: goneToo, file: pdf() }, failing.deps)).rejects.toThrow();
		expect(await pendingKeys()).toEqual([...failing.objects.keys()]);
	});
});
