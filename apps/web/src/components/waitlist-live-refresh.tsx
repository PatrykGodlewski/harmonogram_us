import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import { inArray, useLiveQuery } from "@tanstack/react-db";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useMyRegistrations } from "~/lib/registration/use-my-registrations";

/**
 * Promotions happen in someone else's transaction. When the live seat-count row of
 * an event the user waits for changes, refetch their registrations so a promotion
 * (or a new waitlist position) shows without a reload. Client-only (live query).
 */
export function WaitlistLiveRefresh({ userId }: { userId: string }) {
	const queryClient = useQueryClient();
	const { byEvent } = useMyRegistrations(userId);
	// Keyed by content: a refetch that returns the same waitlist keeps the same live query.
	const waitedForKey = [...byEvent]
		.flatMap(([eventId, entry]) =>
			entry.state === "waitlisted" ? [eventId] : [],
		)
		.sort()
		.join(",");
	const waitedFor = React.useMemo(
		() => (waitedForKey === "" ? [] : waitedForKey.split(",")),
		[waitedForKey],
	);
	const counts = useLiveQuery(
		(q) =>
			waitedFor.length === 0
				? undefined
				: q
						.from({ counts: eventSeatCountsCollection })
						.where(({ counts }) => inArray(counts.event_id, waitedFor))
						.select(({ counts }) => ({
							eventId: counts.event_id,
							updatedAt: counts.updated_at,
						})),
		[waitedFor],
	);

	// Refetch when a count row of an event the user already waited for changes. Joining or
	// leaving a waitlist is refreshed by the action itself, so a changed set alone doesn't count.
	// The first observation refetches once: the counts may show a promotion the cache misses.
	const previous = React.useRef<ReadonlyMap<string, string> | null>(null);
	React.useEffect(() => {
		const current = new Map(
			(counts.data ?? []).map((row) => [row.eventId, String(row.updatedAt)]),
		);
		const seen = previous.current;
		const changed =
			seen === null
				? current.size > 0
				: [...current].some(
						([eventId, updatedAt]) =>
							seen.has(eventId) && seen.get(eventId) !== updatedAt,
					);
		if (changed) {
			void queryClient.invalidateQueries({
				queryKey: myRegistrationsQueryOptions.queryKey,
			});
		}
		// Only add to what was seen: a momentarily empty result (query re-created) must not
		// erase it, or the next change would look like a first observation and be missed.
		if (seen !== null || current.size > 0) {
			previous.current = new Map([...(seen ?? []), ...current]);
		}
	}, [counts.data, queryClient]);

	return null;
}
