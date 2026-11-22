import { describe, expect, it } from "vitest";
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

	it("does nothing without storage", async () => {
		const { deps, pending } = fakes(["a"]);
		expect(await deleteStoredFiles({ ...deps, config: null })).toEqual({ deleted: 0, failed: 0 });
		expect(pending.size).toBe(1);
	});
});
