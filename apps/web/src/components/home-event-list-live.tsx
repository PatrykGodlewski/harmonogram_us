"use client";

import type { EventFiltersParams } from "@repo/api/events/schemas";
import { HomeEventCards } from "~/components/home-event-card";
import { HomeEventListShell } from "~/components/home-event-list-shell";
import { useEventRegistrations } from "~/lib/event-registration/use-event-registrations";
import { useEventListData } from "~/lib/events/use-event-list-data";
import { useEventSeatCounts } from "~/lib/events/use-event-seat-counts";

export type HomeEventListLiveProps = {
	filters: EventFiltersParams;
	user: { id: string; email: string } | null;
};

/** Client list: Electric seat counts + registration mutations. */
export default function HomeEventListLive({
	filters,
	user,
}: HomeEventListLiveProps) {
	const { events, error, isError, loading, refetching } = useEventListData({
		filters,
		userId: user?.id,
	});
	const seatCounts = useEventSeatCounts();
	const registrations = useEventRegistrations({
		filters,
		userId: user?.id,
		seatCounts,
	});

	return (
		<HomeEventListShell
			error={error}
			isError={isError}
			loading={loading}
			events={events}
		>
			<HomeEventCards
				events={events}
				user={user}
				refetching={refetching}
				interactive
				seatCounts={seatCounts}
				registrations={registrations}
			/>
		</HomeEventListShell>
	);
}
