import type { EventFiltersParams } from "@repo/api/events/schemas";
import { HomeEventCards } from "~/components/home-event-card";
import { HomeEventListShell } from "~/components/home-event-list-shell";
import { createQueryRegistrationActions } from "~/lib/events/query-registration-actions";
import { querySeatCountSource } from "~/lib/events/query-seat-counts";
import { useEventListData } from "~/lib/events/use-event-list-data";

export type HomeEventListProps = {
	filters: EventFiltersParams;
	user: { id: string; email: string } | null;
};

/** SSR-safe list: loader data + query cache only (no Electric / mutations). */
export function HomeEventList({ filters, user }: HomeEventListProps) {
	const { events, error, isError, loading, refetching, registeredEventIds } =
		useEventListData({ filters, userId: user?.id });

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
				interactive={false}
				seatCounts={querySeatCountSource}
				registrations={createQueryRegistrationActions(registeredEventIds)}
			/>
		</HomeEventListShell>
	);
}
