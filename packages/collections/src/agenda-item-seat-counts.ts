import { createCollection } from "@tanstack/db";
import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { z } from "zod";

const AgendaItemSeatCountSchema = z.object({
	agenda_item_id: z.string(),
	event_id: z.string(),
	max_seats: z.number().int().nullable(),
	seats_remaining: z.number().int().nullable(),
	registered_count: z.number().int(),
	updated_at: z.string().optional(),
});

export type AgendaItemSeatCount = z.infer<typeof AgendaItemSeatCountSchema>;

export const agendaItemSeatCountsCollection = createCollection(
	electricCollectionOptions({
		id: "agenda-item-seat-counts",
		getKey: (row) => row.agenda_item_id,
		schema: AgendaItemSeatCountSchema,
		gcTime: Number.POSITIVE_INFINITY,
		startSync: false,
		shapeOptions: {
			url: "/api/electric/agenda-item-seat-counts",
			onError: () => ({}),
		},
	}),
);

export function ensureAgendaItemSeatCountsSync() {
	agendaItemSeatCountsCollection.startSyncImmediate();
	return agendaItemSeatCountsCollection.preload();
}
