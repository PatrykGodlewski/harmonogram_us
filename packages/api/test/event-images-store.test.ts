import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	removeLocalEventImage,
	storeEventImage,
} from "../src/event-images/store";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const image = { bytes: PNG.buffer, mimeType: "image/png" };

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "event-images-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("local image directory", () => {
	it("writes under a new event-images/{eventId}/ key and deletes it again", async () => {
		const put = vi.fn();
		const key = await storeEventImage("e1", image, { config: null, put, dir });
		expect(key).toMatch(/^event-images\/e1\/[0-9a-f-]{36}$/);
		expect(put).not.toHaveBeenCalled();
		expect(new Uint8Array(await readFile(join(dir, key)))).toEqual(PNG);

		await removeLocalEventImage(key, dir);
		await expect(readFile(join(dir, key))).rejects.toThrow();
		// Already gone counts as deleted.
		await expect(removeLocalEventImage(key, dir)).resolves.toBeUndefined();
	});

	it("refuses a key outside the directory", async () => {
		await expect(removeLocalEventImage("../outside", dir)).rejects.toThrow(
			"outside",
		);
	});
});

it("puts the bytes in the bucket when one is configured", async () => {
	const config = {
		endpoint: "https://s3.example",
		bucket: "b",
		accessKeyId: "k",
		secretAccessKey: "s",
		region: "auto",
	};
	const put = vi.fn(async () => {});
	const key = await storeEventImage("e1", image, { config, put, dir });
	expect(put).toHaveBeenCalledWith(config, key, image.bytes, "image/png");
});
