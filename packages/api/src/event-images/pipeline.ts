/** Server-only (worker): prompt → image → storage → event row. */
import { db } from "@repo/db/client";
import {
	failEventImage,
	getEventImageSource,
	markImagePending,
	setEventImage,
} from "@repo/db/queries/event-images";
import type { EventImageJob } from "@repo/jobs/queues";
import { buildImagePrompt, imageStyle, sourceHash } from "./prompt";
import {
	type GeneratedImage,
	type GenerateImageOptions,
	generateImage,
	randomSeed,
} from "./providers";
import { storeEventImage } from "./store";

export type PipelineDeps = {
	styleSuffix: string;
	prompt: (title: string, description: string | null) => Promise<string>;
	generate: (
		prompt: string,
		options: GenerateImageOptions,
	) => Promise<GeneratedImage>;
	store: (eventId: string, image: GeneratedImage) => Promise<string>;
	save: typeof setEventImage;
	seed: () => number;
};

const defaultDeps = (): PipelineDeps => ({
	styleSuffix: imageStyle(),
	prompt: (title, description) => buildImagePrompt(title, description),
	generate: (prompt, options) => generateImage(prompt, options),
	store: (eventId, image) => storeEventImage(eventId, image),
	save: setEventImage,
	seed: randomSeed,
});

/** 16:9, the cover's shape everywhere it is shown. */
const SIZE = { width: 1024, height: 576 };

/**
 * Generates the image from the event's current text (a queued job may predate an edit).
 * A provider, storage or save failure marks the event failed; the placeholder stays.
 */
export async function generateEventImage(
	job: EventImageJob,
	deps: PipelineDeps = defaultDeps(),
): Promise<"ready" | "failed" | "skipped"> {
	const source = await getEventImageSource(job.eventId);
	if (!source) {
		return "skipped";
	}
	const hash = sourceHash(source.title, source.description, deps.styleSuffix);
	if (!job.force && source.status === "ready" && source.sourceHash === hash) {
		return "skipped";
	}
	// Text changed without a request (saved while the feature was off, a new style).
	await markImagePending(db, job.eventId, hash);
	const prompt = await deps.prompt(source.title, source.description);
	const seed = deps.seed();
	try {
		const image = await deps.generate(prompt, { seed, ...SIZE });
		const key = await deps.store(job.eventId, image);
		await deps.save(job.eventId, {
			key,
			url: `/api/event-images/${job.eventId}`,
			prompt,
			seed,
			sourceHash: hash,
		});
	} catch (error) {
		console.error(`[event-images] event ${job.eventId} failed:`, error);
		await failEventImage(job.eventId, hash);
		return "failed";
	}
	return "ready";
}
