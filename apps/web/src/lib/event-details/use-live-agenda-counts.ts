import { agendaItemSeatCountsCollection } from "@repo/collections/agenda-item-seat-counts";
import { useLiveQuery } from "@tanstack/react-db";
import * as React from "react";
import type { ItemSeatCount, ItemSeatCountSource } from "./types";

export function useLiveAgendaCounts(): ItemSeatCountSource {
	const live = useLiveQuery((q) =>
		q
			.from({ counts: agendaItemSeatCountsCollection })
			.select(({ counts }) => counts),
	);

	const byItemId = React.useMemo(() => {
		const map = new Map<string, ItemSeatCount>();
		for (const row of live.data ?? []) {
			map.set(row.agenda_item_id, {
				seatsRemaining: row.seats_remaining,
				maxSeats: row.max_seats,
				registeredCount: row.registered_count,
			});
		}
		return map;
	}, [live.data]);

	const getItemCount = React.useCallback(
		(itemId: string, fallback: ItemSeatCount) =>
			byItemId.get(itemId) ?? fallback,
		[byItemId],
	);

	return { getItemCount };
}
