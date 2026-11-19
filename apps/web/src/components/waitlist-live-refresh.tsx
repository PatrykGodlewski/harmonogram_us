import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import { useLiveQuery } from "@tanstack/react-db";
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
	const counts = useLiveQuery((q) =>
		q
			.from({ counts: eventSeatCountsCollection })
			.select(({ counts }) => counts),
	);
	const signature = (counts.data ?? [])
		.filter((row) => waitedFor.has(row.event_id))
		.map((row) => `${row.event_id}:${String(row.updated_at)}`)
		.sort()
		.join("|");

	// null until the first observation; a first non-empty signature also refetches once,
	// because the counts may have arrived after a promotion the cached registrations miss.
	const previous = React.useRef<string | null>(null);
	React.useEffect(() => {
		const changed =
			previous.current === null
				? signature !== ""
				: previous.current !== signature;
		if (changed) {
			void queryClient.invalidateQueries({
				queryKey: myRegistrationsQueryOptions.queryKey,
			});
		}
		previous.current = signature;
	}, [signature, queryClient]);

	return null;
}
