import { eventsQueryOptions } from "@repo/api/events/queries";
import type { EventFiltersParams } from "@repo/api/events/schemas";
import type { EventSeatCount as LiveSeatCountRow } from "@repo/collections/event-seat-counts";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import type { QueryClient } from "@tanstack/react-query";

import type { RegistrationMutationResult } from "~/lib/event-registration/types";
import type { EventSeatCount } from "./types";

export function buildLiveSeatCountMap(rows: LiveSeatCountRow[] = []) {
	const map = new Map<string, EventSeatCount>();
	for (const row of rows) {
		map.set(row.event_id, {
			seatsRemaining: row.seats_remaining,
			maxSeats: row.max_seats,
		});
	}
	return map;
}

export function resolveDisplaySeatCount(
	liveCount: EventSeatCount | undefined,
	fallback: EventSeatCount,
	adjustment: number,
): EventSeatCount {
	const baseSeatsRemaining =
		liveCount?.seatsRemaining ?? fallback.seatsRemaining;
	const maxSeats = liveCount?.maxSeats ?? fallback.maxSeats;

	return {
		maxSeats,
		seatsRemaining: Math.min(
			maxSeats,
			Math.max(0, baseSeatsRemaining + adjustment),
		),
	};
}

function eventsQueryKey(filters: EventFiltersParams) {
	return eventsQueryOptions(filters).queryKey;
}

export function refreshEventsList(
	queryClient: QueryClient,
	filters: EventFiltersParams,
) {
	return queryClient.invalidateQueries({
		queryKey: eventsQueryKey(filters),
	});
}

export async function syncSeatCountAfterLocalChange(
	queryClient: QueryClient,
	filters: EventFiltersParams,
	result: RegistrationMutationResult | undefined,
) {
	if (typeof result?.txid !== "number") {
		return;
	}

	try {
		await eventSeatCountsCollection.utils.awaitTxId(result.txid);
	} catch {
		await refreshEventsList(queryClient, filters);
	}
}

export async function reconcileRemoteSeatCountChange(
	queryClient: QueryClient,
	filters: EventFiltersParams,
	txid: number | undefined,
) {
	if (typeof txid === "number") {
		await eventSeatCountsCollection.utils.awaitTxId(txid).catch(() => {});
	}

	await refreshEventsList(queryClient, filters);
}
