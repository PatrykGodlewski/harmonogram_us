import { createCollection } from "@tanstack/db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { z } from "zod";
import { handleShapeError } from "./shape-errors";
import { shapeUrl } from "./shape-url";
import { shapes } from "./shapes";

const CancelledEventSchema = z.object({
	id: z.string(),
	status: z.string(),
	cancelled_at: z.string().nullable().optional(),
});

export type CancelledEvent = z.infer<typeof CancelledEventSchema>;

export const cancelledEventsCollection = createCollection(
	electricCollectionOptions({
		id: "cancelled-events",
		getKey: (row) => row.id,
		schema: CancelledEventSchema,
		gcTime: Number.POSITIVE_INFINITY,
		startSync: false,
		shapeOptions: {
			url: shapeUrl(shapes.cancelledEvents.path),
			onError: handleShapeError,
		},
	}),
);

export function ensureCancelledEventsSync() {
	cancelledEventsCollection.startSyncImmediate();
	return cancelledEventsCollection.preload();
}
