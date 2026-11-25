import { describe, expect, it, vi } from "vitest";
import {
	buildImagePrompt,
	type PromptDeps,
	sourceHash,
} from "../src/event-images/prompt";

const STYLE = "flat editorial illustration, no text";

function deps(fetch: PromptDeps["fetch"]): PromptDeps {
	return { fetch, apiKey: "sk-test", model: "claude-test", styleSuffix: STYLE };
}

const reply = (text: string) =>
	new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
		headers: { "content-type": "application/json" },
	});

describe("buildImagePrompt", () => {
	it("asks the Messages API and appends the style suffix to its scene", async () => {
		const fetch = vi.fn(async () => reply("A dim basement bar with a jazz quartet."));
		const prompt = await buildImagePrompt(
			"Jazz night",
			"Live quartet",
			deps(fetch),
		);
		expect(prompt).toBe(`A dim basement bar with a jazz quartet, ${STYLE}`);

		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.anthropic.com/v1/messages");
		expect(init.method).toBe("POST");
		expect(init.headers).toMatchObject({
			"x-api-key": "sk-test",
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		});
		const body = JSON.parse(String(init.body));
		expect(body).toMatchObject({ model: "claude-test", max_tokens: 150 });
		expect(body.system).toEqual(expect.any(String));
		expect(body.messages).toEqual([
			{ role: "user", content: "Jazz night\n\nLive quartet" },
		]);
	});

	it.each([
		["an HTTP error", async () => new Response("overloaded", { status: 529 })],
		["a network error", async () => Promise.reject(new TypeError("fetch failed"))],
		["an empty reply", async () => reply("  ")],
	])("falls back to the cleaned title on %s", async (_name, fetch) => {
		const prompt = await buildImagePrompt(
			'Wieczór „planszówek" 2026 "XL" o 20:00',
			null,
			deps(fetch as PromptDeps["fetch"]),
		);
		expect(prompt).toBe(`atmospheric scene for Wieczór planszówek XL o :, ${STYLE}`);
	});

	it("falls back without calling out when no API key is set", async () => {
		const fetch = vi.fn();
		const prompt = await buildImagePrompt("Run 10k", null, {
			...deps(fetch),
			apiKey: undefined,
		});
		expect(prompt).toBe(`atmospheric scene for Run k, ${STYLE}`);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe("sourceHash", () => {
	it("is a stable sha256 hex for equal inputs", () => {
		const hash = sourceHash("T", "D", STYLE);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
		expect(sourceHash("T", "D", STYLE)).toBe(hash);
		expect(sourceHash("T", null, STYLE)).toBe(sourceHash("T", "", STYLE));
	});

	it("changes when the title, description or style changes", () => {
		const hash = sourceHash("T", "D", STYLE);
		expect(sourceHash("T2", "D", STYLE)).not.toBe(hash);
		expect(sourceHash("T", "D2", STYLE)).not.toBe(hash);
		expect(sourceHash("T", "D", `${STYLE}, grain`)).not.toBe(hash);
	});
});
