import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { listAgendaItems } from "@repo/db/queries/agenda-items";
import { takeStoredFileDeletions } from "@repo/db/queries/event-files";
import { agendaItems } from "@repo/db/schema/agenda";
import { createEvent, createItem, rejectionCode, resetDb } from "../../db/test/helpers";
import {
	agendaItemImageResponse,
	type ItemImageDeps,
	storeAgendaItemImage,
} from "../src/files/item-image";
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
	const objects = new Map<string, string>();
	const deps: ItemImageDeps = {
		config: CONFIG,
		put: async (_config, key, _bytes, type) => {
			await opts.onPut?.(key);
			objects.set(key, type);
		},
		remove: async (_config, key) => {
			if (opts.failDelete) throw new Error("Storage DELETE failed: HTTP 500");
			objects.delete(key);
		},
		presign: async (_config, key, _name, options) =>
			`https://s3.example/files/${key}?inline=${options?.inline}`,
	};
	return { objects, deps };
}

const image = (name = "scena.webp", bytes = 3) => new File([new Uint8Array(bytes)], name);

describe("storeAgendaItemImage", () => {
	it("stores a PNG, JPEG or WebP under the event and sets it with its alt text", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const { objects, deps } = fakeStorage();

		await storeAgendaItemImage({ itemId, file: image(), alt: "Scena" }, deps);
		const [key, type] = [...objects.entries()][0] ?? [];
		expect(key).toMatch(new RegExp(`^events/${eventId}/items/${itemId}-`));
		expect(type).toBe("image/webp");
		const [item] = await listAgendaItems(eventId);
		expect(item).toMatchObject({ hasImage: true, imageAlt: "Scena" });

		// The replaced object is queued for deletion.
		await storeAgendaItemImage({ itemId, file: image("b.png"), alt: "Sala" }, deps);
		expect(await pendingKeys()).toEqual([key]);
	});

	it("records the key before storing and forgets it when the image is set", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const recordedAtPut: string[][] = [];
		const { objects, deps } = fakeStorage({
			onPut: async () => {
				recordedAtPut.push(await pendingKeys());
			},
		});

		await storeAgendaItemImage({ itemId, file: image(), alt: "Scena" }, deps);

		expect(recordedAtPut).toEqual([[...objects.keys()]]);
		expect(await pendingKeys()).toEqual([]);
	});

	it("refuses other types and images over 5 MB before storing anything", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const { objects, deps } = fakeStorage();

		for (const name of ["slajdy.pdf", "logo.svg", "obraz"]) {
			expect(
				await rejectionCode(storeAgendaItemImage({ itemId, file: image(name), alt: "x" }, deps)),
			).toBe("IMAGE_TYPE");
		}
		expect(
			await rejectionCode(
				storeAgendaItemImage(
					{ itemId, file: image("duzy.jpg", 5 * 1024 * 1024 + 1), alt: "x" },
					deps,
				),
			),
		).toBe("IMAGE_TOO_LARGE");
		expect(objects.size).toBe(0);
	});

	it("removes the stored object when the item is gone, or leaves its key for the clean-up", async () => {
		const { objects, deps } = fakeStorage();
		expect(
			await rejectionCode(storeAgendaItemImage({ itemId: "missing", file: image(), alt: "x" }, deps)),
		).toBe("ITEM_NOT_FOUND");
		expect(objects.size).toBe(0);

		// The item is deleted between the lookup and saving the image.
		const deleteItem = (itemId: string) => async () => {
			await db.delete(agendaItems).where(eq(agendaItems.id, itemId));
		};
		const eventId = await createEvent();
		const gone = await createItem(eventId);
		const ok = fakeStorage({ onPut: deleteItem(gone) });
		expect(
			await rejectionCode(storeAgendaItemImage({ itemId: gone, file: image(), alt: "x" }, ok.deps)),
		).toBe("ITEM_NOT_FOUND");
		expect(ok.objects.size).toBe(0);
		expect(await pendingKeys()).toEqual([]);

		const goneToo = await createItem(eventId);
		const failing = fakeStorage({ failDelete: true, onPut: deleteItem(goneToo) });
		await rejectionCode(storeAgendaItemImage({ itemId: goneToo, file: image(), alt: "x" }, failing.deps));
		expect(await pendingKeys()).toEqual([...failing.objects.keys()]);
	});
});

describe("agendaItemImageResponse", () => {
	it("redirects to an inline signed link for viewers of the event, 404 otherwise", async () => {
		const eventId = await createEvent();
		const itemId = await createItem(eventId);
		const { deps } = fakeStorage();
		const allowed = async (id: string) => id === eventId;

		expect((await agendaItemImageResponse(itemId, allowed, deps)).status).toBe(404);
		await storeAgendaItemImage({ itemId, file: image(), alt: "Scena" }, deps);

		const response = await agendaItemImageResponse(itemId, allowed, deps);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toMatch(/\?inline=true$/);
		expect((await agendaItemImageResponse(itemId, async () => false, deps)).status).toBe(404);
		expect((await agendaItemImageResponse("missing", allowed, deps)).status).toBe(404);
	});
});
