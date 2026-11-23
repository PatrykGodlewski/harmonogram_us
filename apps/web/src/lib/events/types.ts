import type { fetchEventsServer } from "@repo/api/events/queries";

export type HomeEventListEvent = Awaited<
	ReturnType<typeof fetchEventsServer>
>["events"][number];

export type EventSeatCount = {
	seatsRemaining: number;
	maxSeats: number;
};
