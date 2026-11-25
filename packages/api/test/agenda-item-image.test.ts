import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { listAgendaItems } from "@repo/db/queries/agenda-items";
import { takeStoredFileDeletions } from "@repo/db/queries/event-files";
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

function fakeStorage() {
	const objects = new Map<string, string>();
	const deps: ItemImageDeps = {
		config: CONFIG,
		put: async (_config, key, _bytes, type) => {
			objects.set(key, type);
		},
		remove: async (_config, key) => {
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
		expect(await takeStoredFileDeletions(10)).toEqual([key]);
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

	it("removes the stored object when the item is gone", async () => {
		const { objects, deps } = fakeStorage();
		expect(
			await rejectionCode(storeAgendaItemImage({ itemId: "missing", file: image(), alt: "x" }, deps)),
		).toBe("ITEM_NOT_FOUND");
		expect(objects.size).toBe(0);
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
