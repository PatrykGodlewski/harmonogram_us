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
	const waitedFor = React.useMemo(
		() =>
			new Set(
				[...byEvent].flatMap(([eventId, entry]) =>
					entry.state === "waitlisted" ? [eventId] : [],
				),
			),
		[byEvent],
	);
	const counts = useLiveQuery(
		(q) =>
			waitedFor.size === 0
				? undefined
				: q
						.from({ counts: eventSeatCountsCollection })
						.where(({ counts }) => inArray(counts.event_id, [...waitedFor]))
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
		if (seen !== null || current.size > 0) {
			previous.current = current;
		}
	}, [counts.data, queryClient]);

	return null;
}
