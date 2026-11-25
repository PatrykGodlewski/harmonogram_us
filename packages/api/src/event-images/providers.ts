/** Server-only: text-to-image providers (FLUX.1 schnell on fal or Cloudflare Workers AI). */
import { randomInt } from "node:crypto";
import { env } from "@repo/env";

export type ImageProvider =
	| { kind: "fal"; key: string }
	| { kind: "cloudflare"; accountId: string; token: string };

export type GenerateImageOptions = {
	/** Random when not given. */
	seed?: number;
	width: number;
	height: number;
};

export type GeneratedImage = { bytes: ArrayBuffer; mimeType: string };

export type ProviderDeps = {
	provider: ImageProvider | null;
	fetch: typeof fetch;
	/** Per attempt. */
	timeoutMs: number;
};

const FAL_URL = "https://fal.run/fal-ai/flux/schnell";
const CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** The provider `IMAGE_PROVIDER` names, or null when its keys are missing. */
export function imageProvider(): ImageProvider | null {
	if (env.IMAGE_PROVIDER === "cloudflare") {
		const { CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN } = env;
		return CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_API_TOKEN
			? {
					kind: "cloudflare",
					accountId: CLOUDFLARE_ACCOUNT_ID,
					token: CLOUDFLARE_API_TOKEN,
				}
			: null;
	}
	return env.FAL_KEY ? { kind: "fal", key: env.FAL_KEY } : null;
}

const defaultDeps = (): ProviderDeps => ({
	provider: imageProvider(),
	fetch,
	timeoutMs: 30_000,
});

/** A seed that fits the event's `integer` column. */
export function randomSeed(): number {
	return randomInt(0, 2 ** 31);
}

export async function generateImage(
	prompt: string,
	options: GenerateImageOptions,
	deps: ProviderDeps = defaultDeps(),
): Promise<GeneratedImage> {
	const { provider } = deps;
	if (!provider) {
		throw new Error("Image provider is not configured");
	}
	const seed = options.seed ?? randomSeed();
	if (provider.kind === "fal") {
		const result = await request(deps, FAL_URL, {
			method: "POST",
			headers: {
				Authorization: `Key ${provider.key}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				prompt,
				image_size: { width: options.width, height: options.height },
				seed,
				output_format: "png",
			}),
		});
		const body = (await result.json()) as { images?: { url?: string }[] };
		const url = body.images?.[0]?.url;
		if (!url) {
			throw new Error("Image provider returned no image URL");
		}
		return asImage(await (await request(deps, url, {})).arrayBuffer());
	}
	const response = await request(
		deps,
		`https://api.cloudflare.com/client/v4/accounts/${provider.accountId}/ai/run/${CLOUDFLARE_MODEL}`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${provider.token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				prompt,
				width: options.width,
				height: options.height,
				seed,
			}),
		},
	);
	return asImage(await response.arrayBuffer());
}

/** One retry after a network error, a timeout or a 5xx; errors carry only the status. */
async function request(
	deps: ProviderDeps,
	url: string,
	init: RequestInit,
): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		const last = attempt === 2;
		let response: Response;
		try {
			response = await deps.fetch(url, {
				...init,
				signal: AbortSignal.timeout(deps.timeoutMs),
			});
		} catch (error) {
			if (last) throw error;
			continue;
		}
		if (response.ok) {
			return response;
		}
		if (response.status < 500 || last) {
			throw new Error(`Image provider HTTP ${response.status}`);
		}
	}
}

/** The image type from its first bytes; anything else (an error page, JSON) is refused. */
export function sniffImageType(bytes: ArrayBuffer): string | null {
	const head = new Uint8Array(bytes.slice(0, 12));
	const ascii = (from: number, to: number) =>
		String.fromCharCode(...head.slice(from, to));
	if (head[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
	if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)
		return "image/jpeg";
	if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
	return null;
}

function asImage(bytes: ArrayBuffer): GeneratedImage {
	const mimeType = sniffImageType(bytes);
	if (!mimeType) {
		throw new Error("Image provider reply is not an image");
	}
	return { bytes, mimeType };
}
