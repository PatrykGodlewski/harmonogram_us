import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import { useLiveQuery } from "@tanstack/react-db";
import * as React from "react";

import { buildLiveSeatCountMap, resolveDisplaySeatCount } from "./seat-count";
import type { EventSeatCount, EventSeatCountSource } from "./types";

export function useEventSeatCounts(): EventSeatCountSource & {
	adjust: (eventId: string, delta: number) => void;
	clear: (eventId: string) => void;
} {
	const liveCounts = useLiveQuery((q) =>
		q
			.from({ eventSeatCounts: eventSeatCountsCollection })
			.select(({ eventSeatCounts }) => eventSeatCounts),
	);
	const [adjustments, setAdjustments] = React.useState<Record<string, number>>(
		{},
	);

	const liveSeatCountByEventId = React.useMemo(() => {
		return buildLiveSeatCountMap(liveCounts.data ?? []);
	}, [liveCounts.data]);

	const adjust = React.useCallback((eventId: string, delta: number) => {
		setAdjustments((prev) => ({
			...prev,
			[eventId]: (prev[eventId] ?? 0) + delta,
		}));
	}, []);

	const clear = React.useCallback((eventId: string) => {
		setAdjustments((prev) => {
			if (!(eventId in prev)) {
				return prev;
			}

			const next = { ...prev };
			delete next[eventId];
			return next;
		});
	}, []);

	const getDisplaySeatCount = React.useCallback(
		(eventId: string, fallback: EventSeatCount): EventSeatCount => {
			return resolveDisplaySeatCount(
				liveSeatCountByEventId.get(eventId),
				fallback,
				adjustments[eventId] ?? 0,
			);
		},
		[adjustments, liveSeatCountByEventId],
	);

	return { adjust, clear, getDisplaySeatCount };
}
