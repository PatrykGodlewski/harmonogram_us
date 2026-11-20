import { cancelledEventsCollection } from "@repo/collections/cancelled-events";
import { eq, useLiveQuery } from "@tanstack/react-db";

/** Whether the event is cancelled: from the server-rendered status, or live once it changes. */
export function useEventCancelled(
	eventId: string,
	initialStatus: "draft" | "published" | "cancelled",
): boolean {
	// The collection starts syncing with its first subscriber (startSync: false).
	const live = useLiveQuery(
		(q) =>
			q
				.from({ cancelled: cancelledEventsCollection })
				.where(({ cancelled }) => eq(cancelled.id, eventId)),
		[eventId],
	);
	return initialStatus === "cancelled" || (live.data?.length ?? 0) > 0;
}
