import {
	cancelledEventsCollection,
	ensureCancelledEventsSync,
} from "@repo/collections/cancelled-events";
import { eq, useLiveQuery } from "@tanstack/react-db";
import { useEffect } from "react";

/** Whether the event is cancelled: from the server-rendered status, or live once it changes. */
export function useEventCancelled(
	eventId: string,
	initialStatus: "draft" | "published" | "cancelled",
): boolean {
	useEffect(() => {
		void ensureCancelledEventsSync();
	}, []);
	const live = useLiveQuery(
		(q) =>
			q
				.from({ cancelled: cancelledEventsCollection })
				.where(({ cancelled }) => eq(cancelled.id, eventId)),
		[eventId],
	);
	return initialStatus === "cancelled" || (live.data?.length ?? 0) > 0;
}
