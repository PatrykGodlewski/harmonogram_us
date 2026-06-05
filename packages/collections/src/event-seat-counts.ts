import { createCollection } from "@tanstack/db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { z } from "zod";

const EventSeatCountSchema = z.object({
	event_id: z.string(),
	seats_remaining: z.number().int(),
	max_seats: z.number().int(),
	updated_at: z.string().optional(),
});

export type EventSeatCount = z.infer<typeof EventSeatCountSchema>;

export const eventSeatCountsCollection = createCollection(
	electricCollectionOptions({
		id: "event-seat-counts",
		getKey: (row) => row.event_id,
		schema: EventSeatCountSchema,
		gcTime: Number.POSITIVE_INFINITY,
		startSync: false,
		shapeOptions: {
			url: "/api/electric/event-seat-counts",
			onError: () => ({}),
		},
	}),
);

export function ensureEventSeatCountsSync() {
	eventSeatCountsCollection.startSyncImmediate();
	return eventSeatCountsCollection.preload();
}
