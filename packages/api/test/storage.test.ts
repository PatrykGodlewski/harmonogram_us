import { afterEach, describe, expect, it, vi } from "vitest";
import {
	contentDisposition,
	deleteObject,
	presignDownload,
	putObject,
	type StorageConfig,
} from "../src/storage/s3";

const CONFIG: StorageConfig = {
	endpoint: "https://s3.example",
	bucket: "files",
	accessKeyId: "key-1",
	secretAccessKey: "secret-1",
	region: "auto",
};

type Call = { url: string; method: string; headers: Headers };

function stubFetch(status: number) {
	const calls: Call[] = [];
	vi.stubGlobal("fetch", async (input: Request | string, init?: RequestInit) => {
		const request = new Request(input, init);
		calls.push({ url: request.url, method: request.method, headers: request.headers });
		return new Response(null, { status });
	});
	return calls;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("putObject", () => {
	it("puts the bytes at {endpoint}/{bucket}/{key} with a signature and the content type", async () => {
		const calls = stubFetch(200);
		await putObject(CONFIG, "events/e1/f1", new TextEncoder().encode("pdf").buffer, "application/pdf");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.method).toBe("PUT");
		expect(calls[0]?.url).toBe("https://s3.example/files/events/e1/f1");
		expect(calls[0]?.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=key-1\//);
		expect(calls[0]?.headers.get("content-type")).toBe("application/pdf");
	});

	it("throws with only the status when the store refuses", async () => {
		stubFetch(403);
		await expect(
			putObject(CONFIG, "events/e1/f1", new ArrayBuffer(1), "application/pdf"),
		).rejects.toThrow(/^Storage PUT failed: HTTP 403$/);
	});
});

describe("deleteObject", () => {
	it("deletes the object and treats a missing one as deleted", async () => {
		const calls = stubFetch(404);
		await deleteObject(CONFIG, "events/e1/f1");
		expect(calls[0]?.method).toBe("DELETE");
		expect(calls[0]?.url).toBe("https://s3.example/files/events/e1/f1");
	});

	it("throws on other errors", async () => {
		stubFetch(500);
		await expect(deleteObject(CONFIG, "events/e1/f1")).rejects.toThrow(/HTTP 500/);
	});
});

describe("presignDownload", () => {
	it("gives a 60-second signed GET that downloads under the file's name", async () => {
		const url = new URL(await presignDownload(CONFIG, "events/e1/f1", "Slajdy.pdf"));
		expect(`${url.origin}${url.pathname}`).toBe("https://s3.example/files/events/e1/f1");
		expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
		expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
		expect(url.searchParams.get("response-content-disposition")).toBe(
			'attachment; filename="Slajdy.pdf"; filename*=UTF-8\'\'Slajdy.pdf',
		);
	});
});

describe("presignDownload inline", () => {
	it("shows an image in the page instead of downloading it", async () => {
		const url = new URL(
			await presignDownload(CONFIG, "events/e1/items/i1", "image", { inline: true }),
		);
		expect(url.searchParams.get("response-content-disposition")).toBe("inline");
	});
});

describe("contentDisposition", () => {
	it("keeps Polish names through RFC 5987 with an ASCII fallback", () => {
		expect(contentDisposition("Prezentacja żółć.pdf")).toBe(
			"attachment; filename=\"Prezentacja zolc.pdf\"; filename*=UTF-8''Prezentacja%20%C5%BC%C3%B3%C5%82%C4%87.pdf",
		);
	});

	it("cannot break out of the quoted fallback", () => {
		expect(contentDisposition('a"b\\c.txt')).toBe(
			"attachment; filename=\"a_b_c.txt\"; filename*=UTF-8''a%22b%5Cc.txt",
		);
	});
});

describe("storageConfig", () => {
	it("is off unless endpoint, bucket and both keys are set", async () => {
		const full = {
			S3_ENDPOINT: "http://localhost:8333/",
			S3_BUCKET: "files",
			S3_ACCESS_KEY_ID: "key",
			S3_SECRET_ACCESS_KEY: "secret",
			S3_REGION: "auto",
		};
		for (const env of [full, { ...full, S3_SECRET_ACCESS_KEY: undefined }]) {
			vi.resetModules();
			vi.doMock("@repo/env", () => ({ env }));
			const { storageConfig } = await import("../src/storage/s3");
			if (env.S3_SECRET_ACCESS_KEY) {
				expect(storageConfig()).toMatchObject({ endpoint: "http://localhost:8333", bucket: "files" });
			} else {
				expect(storageConfig()).toBeNull();
			}
		}
		vi.doUnmock("@repo/env");
	});
});
