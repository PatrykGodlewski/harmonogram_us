import type { fetchEventsServer } from "@repo/api/events/queries";

export type HomeEventListEvent = Awaited<
	ReturnType<typeof fetchEventsServer>
>[number];

export type EventSeatCount = {
	seatsRemaining: number;
	maxSeats: number;
};

export type EventSeatCountSource = {
	getDisplaySeatCount: (
		eventId: string,
		fallback: EventSeatCount,
	) => EventSeatCount;
};
