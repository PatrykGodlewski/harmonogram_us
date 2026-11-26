/**
 * Server-only: a new cover image on an organizer's request (a fresh seed, same text).
 * The panel calls it through `admin/event-image.ts`.
 */
import { db } from "@repo/db/client";
import {
	getEventImageSource,
	markImagePending,
} from "@repo/db/queries/event-images";
import { enqueueEventImage } from "@repo/jobs/client";
import { assertCanManageEvent } from "../auth/event-access";
import type { AuthenticatedUser } from "../auth/user";
import { appError } from "../errors";
import { consumeRateLimit, type RateLimit } from "../security/rate-limit";
import { sourceHash } from "./prompt";
import { defaultQueueDeps, type QueueDeps } from "./queue";

/** Each image costs money: 10 per organizer per hour. */
export const EVENT_IMAGE_REGENERATE_LIMIT: RateLimit = {
	points: 10,
	durationSeconds: 60 * 60,
};

export async function regenerateEventImage(
	user: AuthenticatedUser,
	eventId: string,
	deps: QueueDeps = defaultQueueDeps(),
): Promise<void> {
	await assertCanManageEvent(user, eventId);
	if (!deps.enabled) {
		// No dedicated error code yet: the UI hides the action when images are off.
		throw appError("NOT_FOUND");
	}
	await consumeRateLimit(
		"event-image-regenerate",
		EVENT_IMAGE_REGENERATE_LIMIT,
		user.id,
	);
	const source = await getEventImageSource(eventId);
	if (!source) {
		throw appError("NOT_FOUND");
	}
	const hash = sourceHash(source.title, source.description, deps.styleSuffix);
	const enqueue = deps.enqueue ?? enqueueEventImage;
	await db.transaction(async (tx) => {
		await markImagePending(tx, eventId, hash, { force: true });
		await enqueue({ eventId, force: true }, { tx });
	});
}
