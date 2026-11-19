import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import { useLiveQuery } from "@tanstack/react-db";
import * as React from "react";

import { buildLiveSeatCountMap, resolveDisplaySeatCount } from "./seat-count";
import type { EventSeatCount, EventSeatCountSource } from "./types";

/** Live seat counts from Electric, falling back to the server-rendered count. */
export function useEventSeatCounts(): EventSeatCountSource {
	const liveCounts = useLiveQuery((q) =>
		q
			.from({ eventSeatCounts: eventSeatCountsCollection })
			.select(({ eventSeatCounts }) => eventSeatCounts),
	);

	const liveSeatCountByEventId = React.useMemo(
		() => buildLiveSeatCountMap(liveCounts.data ?? []),
		[liveCounts.data],
	);

	const getDisplaySeatCount = React.useCallback(
		(eventId: string, fallback: EventSeatCount): EventSeatCount =>
			resolveDisplaySeatCount(liveSeatCountByEventId.get(eventId), fallback),
		[liveSeatCountByEventId],
	);

	return { getDisplaySeatCount };
}
