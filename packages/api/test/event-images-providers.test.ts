import { describe, expect, it, vi } from "vitest";
import {
	generateImage,
	type ImageProvider,
	type ProviderDeps,
} from "../src/event-images/providers";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const SIZE = { width: 1024, height: 576 };

const FAL: ImageProvider = { kind: "fal", key: "fal-key" };
const CLOUDFLARE: ImageProvider = {
	kind: "cloudflare",
	accountId: "acc",
	token: "cf-token",
};
const CF_URL =
	"https://api.cloudflare.com/client/v4/accounts/acc/ai/run/@cf/black-forest-labs/flux-1-schnell";

type Call = [string, RequestInit | undefined];

function deps(
	provider: ImageProvider,
	fetch: ProviderDeps["fetch"],
	timeoutMs = 1000,
): ProviderDeps {
	return { provider, fetch, timeoutMs };
}

const falResult = () =>
	Response.json({
		images: [{ url: "https://cdn.fal.media/x.png", content_type: "image/png" }],
		seed: 7,
	});
const bytes = () => new Response(PNG, { headers: { "content-type": "image/png" } });

describe("fal", () => {
	it("posts the prompt with key auth, size object and seed, then downloads images[0].url", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(async (url) =>
			String(url).startsWith("https://fal.run") ? falResult() : bytes(),
		);
		const image = await generateImage(
			"a scene",
			{ seed: 7, ...SIZE },
			deps(FAL, fetch),
		);

		const [url, init] = fetch.mock.calls[0] as Call;
		expect(url).toBe("https://fal.run/fal-ai/flux/schnell");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toMatchObject({
			Authorization: "Key fal-key",
			"content-type": "application/json",
		});
		expect(JSON.parse(String(init?.body))).toEqual({
			prompt: "a scene",
			image_size: { width: 1024, height: 576 },
			seed: 7,
			output_format: "png",
		});
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect((fetch.mock.calls[1] as Call)[0]).toBe("https://cdn.fal.media/x.png");
		expect(new Uint8Array(image.bytes)).toEqual(PNG);
		expect(image.mimeType).toBe("image/png");
	});

	it("draws a random 32-bit seed when none is given", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(async (url) =>
			String(url).startsWith("https://fal.run") ? falResult() : bytes(),
		);
		await generateImage("a scene", SIZE, deps(FAL, fetch));
		const { seed } = JSON.parse(String((fetch.mock.calls[0] as Call)[1]?.body));
		expect(Number.isInteger(seed)).toBe(true);
		expect(seed).toBeGreaterThanOrEqual(0);
		expect(seed).toBeLessThanOrEqual(2_147_483_647);
	});
});

describe("cloudflare", () => {
	it("posts prompt, size and seed with bearer auth; the body is the image", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(
			async () =>
				new Response(PNG, { headers: { "content-type": "application/octet-stream" } }),
		);
		const image = await generateImage(
			"a scene",
			{ seed: 9, ...SIZE },
			deps(CLOUDFLARE, fetch),
		);

		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = fetch.mock.calls[0] as Call;
		expect(url).toBe(CF_URL);
		expect(init?.headers).toMatchObject({ Authorization: "Bearer cf-token" });
		expect(JSON.parse(String(init?.body))).toEqual({
			prompt: "a scene",
			width: 1024,
			height: 576,
			seed: 9,
		});
		expect(new Uint8Array(image.bytes)).toEqual(PNG);
		expect(image.mimeType).toBe("image/png");
	});

	it("retries once after a 5xx and then succeeds", async () => {
		const fetch = vi
			.fn<ProviderDeps["fetch"]>()
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response(PNG));
		const image = await generateImage("p", { seed: 1, ...SIZE }, deps(CLOUDFLARE, fetch));
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(new Uint8Array(image.bytes)).toEqual(PNG);
	});

	it("retries a network error only once", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(async () => {
			throw new TypeError("fetch failed");
		});
		await expect(
			generateImage("p", { seed: 1, ...SIZE }, deps(CLOUDFLARE, fetch)),
		).rejects.toThrow();
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("does not retry a 4xx and keeps secrets out of the error", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(
			async () => new Response("bad token", { status: 401 }),
		);
		const error = await generateImage(
			"p",
			{ seed: 1, ...SIZE },
			deps(CLOUDFLARE, fetch),
		).catch((caught: Error) => caught);
		expect(fetch).toHaveBeenCalledTimes(1);
		expect(String(error)).toContain("HTTP 401");
		expect(String(error)).not.toContain("cf-token");
	});

	it("gives up after the timeout of each attempt", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () =>
						reject(init.signal?.reason),
					);
				}),
		);
		const started = Date.now();
		await expect(
			generateImage("p", { seed: 1, ...SIZE }, deps(CLOUDFLARE, fetch, 20)),
		).rejects.toThrow();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it("rejects a reply that is not an image", async () => {
		const fetch = vi.fn<ProviderDeps["fetch"]>(async () =>
			Response.json({ errors: [] }),
		);
		await expect(
			generateImage("p", { seed: 1, ...SIZE }, deps(CLOUDFLARE, fetch)),
		).rejects.toThrow("not an image");
	});
});

it("refuses to run without a configured provider", async () => {
	await expect(
		generateImage("p", SIZE, { provider: null, fetch: vi.fn(), timeoutMs: 10 }),
	).rejects.toThrow("not configured");
});
