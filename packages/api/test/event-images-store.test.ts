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
		// A missing file is not a deletion: the key may name an object in a bucket.
		await expect(removeLocalEventImage(key, dir)).rejects.toThrow("ENOENT");
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

describe("without a bucket or a directory", () => {
	it("stores nothing and deletes nothing", async () => {
		const put = vi.fn();
		await expect(
			storeEventImage("e1", image, { config: null, put, dir: null }),
		).rejects.toThrow("No storage");
		expect(put).not.toHaveBeenCalled();
		await expect(
			removeLocalEventImage("event-images/e1/abc", null),
		).rejects.toThrow("No storage");
	});
});

describe("eventImagesEnabled", () => {
	const S3 = {
		S3_ENDPOINT: "https://s3.example",
		S3_BUCKET: "b",
		S3_ACCESS_KEY_ID: "k",
		S3_SECRET_ACCESS_KEY: "s",
	};

	async function enabledWith(storage: Record<string, string>) {
		vi.resetModules();
		const keys = {
			EVENT_IMAGE_ENABLED: "true",
			ANTHROPIC_API_KEY: "a",
			IMAGE_PROVIDER: "fal",
			FAL_KEY: "f",
		};
		const none = Object.fromEntries(
			[...Object.keys(S3), "EVENT_IMAGE_DIR"].map((name) => [name, ""]),
		);
		for (const [name, value] of Object.entries({ ...keys, ...none, ...storage })) {
			vi.stubEnv(name, value);
		}
		const { eventImagesEnabled } = await import("../src/event-images/queue");
		return eventImagesEnabled();
	}

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("is on only with a bucket or an image directory", async () => {
		expect(await enabledWith({})).toBe(false);
		expect(await enabledWith(S3)).toBe(true);
		expect(await enabledWith({ EVENT_IMAGE_DIR: dir })).toBe(true);
	});

	it("refuses a relative EVENT_IMAGE_DIR", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(enabledWith({ EVENT_IMAGE_DIR: "data/event-images" })).rejects.toThrow();
		expect(JSON.stringify(error.mock.calls)).toContain(
			"EVENT_IMAGE_DIR must be an absolute path",
		);
		error.mockRestore();
	});
});
