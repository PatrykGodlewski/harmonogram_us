import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { listEventFiles, takeStoredFileDeletions } from "@repo/db/queries/event-files";
import { eventFiles } from "@repo/db/schema/event-files";
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

function fakeStorage(opts: { failDelete?: boolean } = {}) {
	const objects = new Map<string, { bytes: ArrayBuffer; type: string }>();
	const deps: StoreFileDeps = {
		config: CONFIG,
		put: async (_config, key, bytes, type) => {
			objects.set(key, { bytes, type });
		},
		remove: async (_config, key) => {
			if (opts.failDelete) throw new Error("Storage DELETE failed: HTTP 500");
			objects.delete(key);
		},
	};
	return { objects, deps };
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

	it("removes the object when the row cannot be added, or leaves its key for the clean-up", async () => {
		const eventId = await createEvent();
		const foreignItem = await createItem(await createEvent());
		const ok = fakeStorage();
		expect(
			await rejectionCode(storeEventFile({ eventId, agendaItemId: foreignItem, file: pdf() }, ok.deps)),
		).toBe("ITEM_NOT_FOUND");
		expect(ok.objects.size).toBe(0);

		const failing = fakeStorage({ failDelete: true });
		await rejectionCode(storeEventFile({ eventId, agendaItemId: foreignItem, file: pdf() }, failing.deps));
		expect(await takeStoredFileDeletions(10)).toEqual([...failing.objects.keys()]);
	});
});
