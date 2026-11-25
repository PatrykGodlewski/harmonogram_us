import { generateEventImage } from "@repo/api/event-images/pipeline";
import { eventImageJob } from "@repo/jobs/queues";

/**
 * Generates one event's cover image from its current text. Never throws: the queue has no
 * retries (each attempt costs an image) and the pipeline records provider failures itself.
 */
export async function handleEventImageJob(
	data: unknown,
	generate: typeof generateEventImage = generateEventImage,
): Promise<"ready" | "failed" | "skipped" | "error"> {
	try {
		return await generate(eventImageJob.parse(data));
	} catch (error) {
		console.error("[worker] event image job failed:", error);
		return "error";
	}
}
