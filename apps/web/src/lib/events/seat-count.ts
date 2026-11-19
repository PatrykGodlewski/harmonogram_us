import type { EventSeatCount as LiveSeatCountRow } from "@repo/collections/event-seat-counts";
import type { EventSeatCount } from "./types";

export function buildLiveSeatCountMap(rows: LiveSeatCountRow[] = []) {
	const map = new Map<string, EventSeatCount>();
	for (const row of rows) {
		map.set(row.event_id, {
			seatsRemaining: row.seats_remaining,
			maxSeats: row.max_seats,
		});
	}
	return map;
}

export function resolveDisplaySeatCount(
	liveCount: EventSeatCount | undefined,
	fallback: EventSeatCount,
): EventSeatCount {
	return liveCount ?? fallback;
}
