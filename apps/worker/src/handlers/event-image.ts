import { generateEventImage } from "@repo/api/event-images/pipeline";
import { eventImageJob } from "@repo/jobs/queues";

/**
 * Generates one event's cover image from its current text. The pipeline records provider failures
 * itself; anything else (a bad payload, a database error) is logged and rethrown. That is safe
 * because the job is sent with retryLimit 0: pg-boss fails it without another paid attempt and
 * moves it to the dead-letter queue, whose handler marks the cover failed.
 */
export async function handleEventImageJob(
	data: unknown,
	generate: typeof generateEventImage = generateEventImage,
): Promise<"ready" | "failed" | "skipped"> {
	try {
		return await generate(eventImageJob.parse(data));
	} catch (error) {
		console.error("[worker] event image job failed:", error);
		throw error;
	}
}
