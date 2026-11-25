/** Server-only: the text-to-image prompt for an event's cover image. */
import { createHash } from "node:crypto";
import { env } from "@repo/env";

export const DEFAULT_IMAGE_STYLE =
	"flat editorial illustration, soft grain, wide composition, no text, no lettering, no watermark";

const SYSTEM_PROMPT =
	"You write prompts for a text-to-image model. You get the title and description of an event, in any language (often Polish). Reply in English with one short sentence (at most 40 words) describing a single scene that conveys the mood and setting of the event: the place, people, objects, light and atmosphere. Describe only what can be seen. Do not include text, letters, numbers, dates, names or logos. Reply with the scene only, without quotes or any preamble.";

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 30_000;

export type PromptDeps = {
	fetch: typeof fetch;
	apiKey: string | undefined;
	model: string;
	styleSuffix: string;
};

/** The style every prompt ends with (env `EVENT_IMAGE_STYLE`). */
export function imageStyle(): string {
	return env.EVENT_IMAGE_STYLE ?? DEFAULT_IMAGE_STYLE;
}

const defaultDeps = (): PromptDeps => ({
	fetch,
	apiKey: env.ANTHROPIC_API_KEY,
	model: env.EVENT_IMAGE_MODEL,
	styleSuffix: imageStyle(),
});

/** Hash of everything the image is made from: a new image is needed only when it changes. */
export function sourceHash(
	title: string,
	description: string | null,
	styleSuffix: string,
): string {
	return createHash("sha256")
		.update(`${title}\n${description ?? ""}\n${styleSuffix}`)
		.digest("hex");
}

/** A scene from the LLM plus the style; never fails (any LLM error gives a prompt from the title). */
export async function buildImagePrompt(
	title: string,
	description: string | null,
	deps: PromptDeps = defaultDeps(),
): Promise<string> {
	const scene = await describeScene(title, description, deps).catch(() => null);
	if (scene) {
		return `${scene}, ${deps.styleSuffix}`;
	}
	const cleanTitle = title
		.replace(/[\d"'`„”“«»]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return `atmospheric scene for ${cleanTitle}, ${deps.styleSuffix}`;
}

async function describeScene(
	title: string,
	description: string | null,
	deps: PromptDeps,
): Promise<string> {
	if (!deps.apiKey) {
		throw new Error("ANTHROPIC_API_KEY is not set");
	}
	const response = await deps.fetch(MESSAGES_URL, {
		method: "POST",
		headers: {
			"x-api-key": deps.apiKey,
			"anthropic-version": "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: deps.model,
			max_tokens: 150,
			system: SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: description ? `${title}\n\n${description}` : title,
				},
			],
		}),
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Messages API HTTP ${response.status}`);
	}
	const body = (await response.json()) as { content?: { text?: string }[] };
	// The suffix follows a comma, so a closing full stop goes.
	const scene = body.content?.[0]?.text?.trim().replace(/[.\s]+$/, "");
	if (!scene) {
		throw new Error("Messages API returned no text");
	}
	return scene;
}
