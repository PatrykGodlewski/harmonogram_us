import type { fetchEventsServer } from "@repo/api/events/queries";

export type HomeEventListEvent = Awaited<
	ReturnType<typeof fetchEventsServer>
>["events"][number];

/** An event organised in this app (registration, seat counts, details page). */
export type LocalListEvent = Extract<HomeEventListEvent, { source: "local" }>;

/** A read-only event copied from the university's Indico (F16). */
export type IndicoListEvent = Extract<HomeEventListEvent, { source: "indico" }>;

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
