import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type EventImageServeDeps,
	eventImageResponse,
} from "../src/event-images/serve";

const CONFIG = {
	endpoint: "https://s3.example",
	bucket: "b",
	accessKeyId: "k",
	secretAccessKey: "s",
	region: "auto",
};
const KEY = "event-images/e1/abc";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

let dir: string;

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "event-images-serve-"));
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

function deps(overrides: Partial<EventImageServeDeps> = {}): EventImageServeDeps {
	return {
		config: null,
		getKey: async (id) => (id === "e1" ? KEY : null),
		presign: async (_config, key) => `https://s3.example/b/${key}?signed`,
		dir,
		...overrides,
	};
}

const allowed = async (eventId: string) => eventId === "e1";

describe("eventImageResponse", () => {
	it("redirects to an inline signed link when a bucket is configured", async () => {
		const presign = vi.fn(async () => "https://s3.example/signed");
		const response = await eventImageResponse(
			"e1",
			allowed,
			deps({ config: CONFIG, presign }),
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://s3.example/signed");
		expect(presign).toHaveBeenCalledWith(CONFIG, KEY, "image", { inline: true });
	});

	it("streams the local file without a bucket", async () => {
		await mkdir(join(dir, "event-images/e1"), { recursive: true });
		await writeFile(join(dir, KEY), PNG);
		const response = await eventImageResponse("e1", allowed, deps());
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(new Uint8Array(await response.arrayBuffer())).toEqual(PNG);
	});

	it("answers 404 for no ready image, a hidden event, a missing file or a key outside the directory", async () => {
		expect((await eventImageResponse("other", allowed, deps())).status).toBe(404);
		expect(
			(await eventImageResponse("e1", async () => false, deps())).status,
		).toBe(404);
		expect((await eventImageResponse("e1", allowed, deps())).status).toBe(404);
		expect(
			(
				await eventImageResponse(
					"e1",
					allowed,
					deps({ getKey: async () => "../outside" }),
				)
			).status,
		).toBe(404);
	});

	it("answers 404 without a bucket or a directory", async () => {
		await mkdir(join(dir, "event-images/e1"), { recursive: true });
		await writeFile(join(dir, KEY), PNG);
		const response = await eventImageResponse("e1", allowed, deps({ dir: null }));
		expect(response.status).toBe(404);
	});
});
