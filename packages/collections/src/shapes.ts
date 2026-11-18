/**
 * Single source of truth for Electric shapes exposed to the browser.
 * The client collections sync from `path`; the server proxy at `path`
 * decides `table` and `columns` (clients can't choose them).
 */
export type ShapeDefinition = {
	path: `/api/electric/${string}`;
	table: string;
	columns: readonly string[];
};

export const shapes = {
	eventSeatCounts: {
		path: "/api/electric/event-seat-counts",
		table: "event_seat_counts",
		columns: ["event_id", "seats_remaining", "max_seats", "updated_at"],
	},
	agendaItemSeatCounts: {
		path: "/api/electric/agenda-item-seat-counts",
		table: "agenda_item_seat_counts",
		columns: [
			"agenda_item_id",
			"event_id",
			"seats_remaining",
			"max_seats",
			"registered_count",
			"updated_at",
		],
	},
} as const satisfies Record<string, ShapeDefinition>;
