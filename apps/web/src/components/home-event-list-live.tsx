"use client";

import type { EventFiltersParams } from "@repo/api/events/schemas";
import { HomeEventCards } from "~/components/home-event-card";
import { HomeEventListShell } from "~/components/home-event-list-shell";
import { useEventListData } from "~/lib/events/use-event-list-data";
import { useEventSeatCounts } from "~/lib/events/use-event-seat-counts";
import { useEventListRegistrations } from "~/lib/registration/use-event-list-registrations";

export type HomeEventListLiveProps = {
	filters: EventFiltersParams;
	user: { id: string; email: string } | null;
};

/** Client list: Electric seat counts + registration mutations. */
export default function HomeEventListLive({
	filters,
	user,
}: HomeEventListLiveProps) {
	const { events, hasMore, error, isError, loading, refetching } =
		useEventListData({
			filters,
			userId: user?.id,
		});
	const seatCounts = useEventSeatCounts();
	const registrations = useEventListRegistrations(user?.id);

	return (
		<HomeEventListShell
			error={error}
			isError={isError}
			loading={loading}
			events={events}
			hasMore={hasMore}
		>
			{/* The interactive list replaces the server-rendered one; aria-busy marks a refetch in progress. */}
			<div data-live-list aria-busy={refetching}>
				<HomeEventCards
					events={events}
					user={user}
					refetching={refetching}
					interactive
					seatCounts={seatCounts}
					registrations={registrations}
				/>
			</div>
		</HomeEventListShell>
	);
}
