/** Server-only: the text-to-image prompt for an event's cover image. */
import { createHash } from "node:crypto";
import { env } from "@repo/env";

export const DEFAULT_IMAGE_STYLE =
	"flat editorial illustration, soft grain, wide composition, no text, no lettering, no watermark";

const SYSTEM_PROMPT = `You turn an event listing into one prompt for a text-to-image model.
Output only the prompt: one line, in English, at most 60 words, whatever
language the listing is in.

Describe a single scene that captures the event's vibe:
- type of place or setting
- atmosphere and mood
- lighting and time of day
- 2 to 4 concrete visual elements
- a color palette

Never include people's names, brand names, logos, dates, prices, addresses,
or any written words, letters or signs. Don't depict identifiable real people;
show crowds, silhouettes or figures at a distance instead.
If the listing is vague, infer the scene from the type of event. If there is no
clue at all, describe a tasteful abstract scene in fitting colors.`;

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
			// Thinking tokens would count toward max_tokens.
			thinking: { type: "disabled" },
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
	const body = (await response.json()) as {
		content?: { type?: string; text?: string }[];
	};
	const text = body.content?.find((block) => block.type === "text")?.text;
	// The suffix follows a comma, so a closing full stop goes.
	const scene = text?.trim().replace(/[.\s]+$/, "");
	if (!scene) {
		throw new Error("Messages API returned no text");
	}
	return scene;
}
