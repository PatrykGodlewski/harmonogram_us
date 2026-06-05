import { ensureEventSeatCountsSync } from "@repo/collections/event-seat-counts";
import { useEffect } from "react";

export function EventSeatCountsSync() {
	useEffect(() => {
		void ensureEventSeatCountsSync();
	}, []);

	return null;
}
