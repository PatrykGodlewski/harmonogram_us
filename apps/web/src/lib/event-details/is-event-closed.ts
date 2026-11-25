import type { EventDetailsData } from "./types";

/** Cancelled or over: registration is closed. */
export function isEventClosed(
	event: Pick<EventDetailsData, "status" | "effectiveEndsAt">,
): boolean {
	return (
		event.status === "cancelled" ||
		new Date(event.effectiveEndsAt).getTime() <= Date.now()
	);
}
