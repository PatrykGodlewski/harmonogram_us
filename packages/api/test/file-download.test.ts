import { describe, expect, it } from "vitest";
import { type FileDownloadDeps, fileDownloadResponse } from "../src/files/download";
import type { StorageConfig } from "../src/storage/s3";

const CONFIG: StorageConfig = {
	endpoint: "https://s3.example",
	bucket: "files",
	accessKeyId: "k",
	secretAccessKey: "s",
	region: "auto",
};

const FILE = { eventId: "event-1", storageKey: "events/event-1/f", name: "Slajdy.pdf" };

function deps(overrides: Partial<FileDownloadDeps> = {}): FileDownloadDeps {
	return {
		config: CONFIG,
		getFile: async (id) => (id === "file-1" ? FILE : null),
		presign: async (_config, key, name) => `https://s3.example/files/${key}?signed&name=${name}`,
		...overrides,
	};
}

const allowed = async (eventId: string) => eventId === "event-1";

describe("fileDownloadResponse", () => {
	it("redirects to a short-lived signed link when the viewer may see the event", async () => {
		const response = await fileDownloadResponse("file-1", allowed, deps());
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"https://s3.example/files/events/event-1/f?signed&name=Slajdy.pdf",
		);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	it("answers 404 for an unknown file, a hidden event, or no storage", async () => {
		expect((await fileDownloadResponse("other", allowed, deps())).status).toBe(404);
		expect((await fileDownloadResponse("file-1", async () => false, deps())).status).toBe(404);
		expect((await fileDownloadResponse("file-1", allowed, deps({ config: null }))).status).toBe(
			404,
		);
	});
});
