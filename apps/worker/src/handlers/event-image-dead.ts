import {
	failEventImage,
	getEventImageSource,
} from "@repo/db/queries/event-images";
import { eventImageJob } from "@repo/jobs/queues";

/**
 * Marks a cover failed when pg-boss failed its job (the handler threw, the job timed out, or a
 * worker shutdown cut it off), so the organizer can regenerate it. Covers that are no longer
 * pending are left alone. Database errors propagate so pg-boss retries this job.
 */
export async function handleDeadEventImageJob(
	data: unknown,
	load: typeof getEventImageSource = getEventImageSource,
	fail: typeof failEventImage = failEventImage,
): Promise<"failed" | "skipped"> {
	const job = eventImageJob.safeParse(data);
	if (!job.success) {
		console.error(
			"[worker] dead event image job has an invalid payload:",
			job.error,
		);
		return "skipped";
	}
	const source = await load(job.data.eventId);
	if (source?.status !== "pending" || !source.sourceHash) {
		return "skipped";
	}
	await fail(job.data.eventId, source.sourceHash);
	return "failed";
}
