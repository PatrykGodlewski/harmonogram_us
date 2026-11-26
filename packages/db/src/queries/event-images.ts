import { and, eq, sql } from "drizzle-orm";
import { type DbExecutor, db } from "../client";
import { type EventImageStatus, events } from "../schema/events";

/** What a cover image is generated from, and the state of the last request. */
export type EventImageSource = {
	title: string;
	description: string | null;
	sourceHash: string | null;
	status: EventImageStatus | null;
};

export type GeneratedEventImage = {
	key: string;
	url: string;
	prompt: string;
	seed: number;
	/** Hash of the source the image was generated for. */
	sourceHash: string;
};

export async function getEventImageSource(
	eventId: string,
): Promise<EventImageSource | null> {
	const [row] = await db
		.select({
			title: events.title,
			description: events.description,
			sourceHash: events.imageSourceHash,
			status: events.imageStatus,
		})
		.from(events)
		.where(eq(events.id, eventId));
	return row ?? null;
}

/**
 * Requests an image for `sourceHash`; false when that source was already requested
 * (unless forced), so the caller enqueues a job only on true.
 */
export async function markImagePending(
	executor: DbExecutor,
	eventId: string,
	sourceHash: string,
	options: { force?: boolean } = {},
): Promise<boolean> {
	const rows = await executor
		.update(events)
		.set({ imageStatus: "pending", imageSourceHash: sourceHash })
		.where(
			and(
				eq(events.id, eventId),
				options.force
					? undefined
					: sql`${events.imageSourceHash} is distinct from ${sourceHash}`,
			),
		)
		.returning({ id: events.id });
	return rows.length > 0;
}

/**
 * Saves a generated image. It becomes `ready` only if no newer source was requested
 * meanwhile; otherwise the status stays as it is (`pending`), and nothing is served
 * until the newer image is saved.
 */
export async function setEventImage(
	eventId: string,
	image: GeneratedEventImage,
): Promise<void> {
	await db
		.update(events)
		.set({
			imageKey: image.key,
			imageUrl: image.url,
			imagePrompt: image.prompt,
			imageSeed: image.seed,
			imageStatus: sql`case when ${events.imageSourceHash} is not distinct from ${image.sourceHash} then 'ready' else ${events.imageStatus} end`,
		})
		.where(eq(events.id, eventId));
}

/** Marks the request for `sourceHash` failed; a newer request stays pending. */
export async function failEventImage(
	eventId: string,
	sourceHash: string,
): Promise<void> {
	await db
		.update(events)
		.set({ imageStatus: "failed" })
		.where(and(eq(events.id, eventId), eq(events.imageSourceHash, sourceHash)));
}

/** The storage key of the event's image, only while it is `ready` (null otherwise). */
export async function getReadyEventImageKey(
	eventId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ key: events.imageKey })
		.from(events)
		.where(and(eq(events.id, eventId), eq(events.imageStatus, "ready")));
	return row?.key ?? null;
}
