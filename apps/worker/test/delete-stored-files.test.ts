import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeLocalEventImage } from "@repo/api/event-images/store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type DeleteStoredFilesDeps,
	deleteStoredFiles,
} from "../src/handlers/delete-stored-files";

const CONFIG = {
	endpoint: "https://s3.example",
	bucket: "files",
	accessKeyId: "k",
	secretAccessKey: "s",
	region: "auto",
};

function fakes(keys: string[], failing: string[] = []) {
	const pending = new Set(keys);
	const removed: string[] = [];
	let asked = 0;
	const deps: DeleteStoredFilesDeps = {
		config: CONFIG,
		take: async (limit) => {
			asked = limit;
			return [...pending].slice(0, limit);
		},
		remove: async (_config, key) => {
			if (failing.includes(key)) throw new Error("Storage DELETE failed: HTTP 500");
			removed.push(key);
		},
		removeLocal: async () => {
			throw new Error("not used with a bucket");
		},
		forget: async (forgotten) => {
			for (const key of forgotten) pending.delete(key);
		},
	};
	return { deps, pending, removed, asked: () => asked };
}

describe("deleteStoredFiles", () => {
	it("deletes the waiting objects in batches of 500 and forgets their keys", async () => {
		const { deps, pending, removed, asked } = fakes(["a", "b"]);
		expect(await deleteStoredFiles(deps)).toEqual({ deleted: 2, failed: 0 });
		expect(removed).toEqual(["a", "b"]);
		expect(pending.size).toBe(0);
		expect(asked()).toBe(500);
	});

	it("keeps a key whose delete failed for the next run", async () => {
		const { deps, pending } = fakes(["a", "b"], ["b"]);
		expect(await deleteStoredFiles(deps)).toEqual({ deleted: 1, failed: 1 });
		expect([...pending]).toEqual(["b"]);
	});

	it("deletes from the local image directory without a bucket", async () => {
		const { deps, pending, removed } = fakes(["a"]);
		const local: string[] = [];
		const result = await deleteStoredFiles({
			...deps,
			config: null,
			removeLocal: async (key) => {
				local.push(key);
			},
		});
		expect(result).toEqual({ deleted: 1, failed: 0 });
		expect(local).toEqual(["a"]);
		expect(removed).toEqual([]);
		expect(pending.size).toBe(0);
	});

	describe("without a bucket, on a real directory", () => {
		let dir: string;

		beforeEach(async () => {
			dir = await mkdtemp(join(tmpdir(), "stored-files-"));
		});

		afterEach(async () => {
			await rm(dir, { recursive: true, force: true });
		});

		it("forgets only keys whose local file existed and was removed", async () => {
			const present = "event-images/e1/present";
			await mkdir(join(dir, "event-images/e1"), { recursive: true });
			await writeFile(join(dir, present), "png");
			const missing = "event-files/e1/in-the-bucket";
			const outside = "../outside";
			const { deps, pending } = fakes([present, missing, outside]);

			const result = await deleteStoredFiles({
				...deps,
				config: null,
				removeLocal: (key) => removeLocalEventImage(key, dir),
			});

			expect(result).toEqual({ deleted: 1, failed: 2 });
			expect([...pending]).toEqual([missing, outside]);
			await expect(readFile(join(dir, present))).rejects.toThrow("ENOENT");
		});
	});
});
