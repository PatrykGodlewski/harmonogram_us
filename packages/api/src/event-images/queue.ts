/** Server-only: requesting cover images, in the transaction that saves the event. */
import type { TransactionClient } from "@repo/db/client";
import { markImagePending } from "@repo/db/queries/event-images";
import type { EventSaveHooks } from "@repo/db/queries/events";
import { env } from "@repo/env";
import { enqueueEventImage } from "@repo/jobs/client";
import { imageStyle, sourceHash } from "./prompt";
import { imageProvider } from "./providers";
import { imageStorageConfigured } from "./store";

export type QueueDeps = {
	enabled: boolean;
	styleSuffix: string;
	enqueue?: typeof enqueueEventImage;
};

/**
 * On when enabled, both the prompt model and the image provider have keys, and there is
 * somewhere to keep the image (a bucket or EVENT_IMAGE_DIR).
 */
export function eventImagesEnabled(): boolean {
	return (
		env.EVENT_IMAGE_ENABLED === "true" &&
		Boolean(env.ANTHROPIC_API_KEY) &&
		imageProvider() !== null &&
		imageStorageConfigured()
	);
}

export const defaultQueueDeps = (): QueueDeps => ({
	enabled: eventImagesEnabled(),
	styleSuffix: imageStyle(),
});

/**
 * Asks for an image when the event's text changed. Runs in a savepoint and only logs
 * failures: a cover image never stops an event from being saved.
 */
export function eventImageHooks(
	deps: QueueDeps = defaultQueueDeps(),
): EventSaveHooks {
	return {
		async onEventSaved(tx, event) {
			if (!deps.enabled) {
				return;
			}
			const hash = sourceHash(event.title, event.description, deps.styleSuffix);
			const enqueue = deps.enqueue ?? enqueueEventImage;
			try {
				await tx.transaction(async (savepoint: TransactionClient) => {
					if (await markImagePending(savepoint, event.id, hash)) {
						await enqueue(
							{ eventId: event.id, force: false },
							{ tx: savepoint },
						);
					}
				});
			} catch (error) {
				console.error("[event-images] could not request a cover image", error);
			}
		},
	};
}
