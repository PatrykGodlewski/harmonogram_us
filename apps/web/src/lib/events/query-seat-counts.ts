import type { EventSeatCountSource } from "./types";

export const querySeatCountSource: EventSeatCountSource = {
	getDisplaySeatCount: (_eventId, fallback) => fallback,
};
