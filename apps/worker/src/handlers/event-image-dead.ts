import {
	failEventImage,
	getEventImageSource,
} from "@repo/db/queries/event-images";
import { eventImageJob } from "@repo/jobs/queues";

/**
 * Marks a cover failed when pg-boss gave up on its job (the worker died, so the job expired),
 * so the organizer can regenerate it. Covers that are no longer pending are left alone.
 */
export async function handleDeadEventImageJob(
	data: unknown,
	load: typeof getEventImageSource = getEventImageSource,
	fail: typeof failEventImage = failEventImage,
): Promise<"failed" | "skipped" | "error"> {
	try {
		const { eventId } = eventImageJob.parse(data);
		const source = await load(eventId);
		if (source?.status !== "pending" || !source.sourceHash) {
			return "skipped";
		}
		await fail(eventId, source.sourceHash);
		return "failed";
	} catch (error) {
		console.error("[worker] dead event image job failed:", error);
		return "error";
	}
}
