import type { EventFiltersParams } from "@repo/api/events/schemas";
import { HomeEventCards } from "~/components/home-event-card";
import { HomeEventListShell } from "~/components/home-event-list-shell";
import { useEventListData } from "~/lib/events/use-event-list-data";

type HomeEventListProps = {
	filters: EventFiltersParams;
	userId: string | undefined;
};

/** The event list: rendered on the server, hydrated in place, refreshed every 15 s. */
export function HomeEventList({ filters, userId }: HomeEventListProps) {
	const {
		events,
		hasMore,
		error,
		isError,
		loading,
		refetching,
		registrationStates,
	} = useEventListData({ filters, userId });

	return (
		<HomeEventListShell
			error={error}
			isError={isError}
			loading={loading}
			events={events}
			hasMore={hasMore}
		>
			<HomeEventCards
				events={events}
				registrationStates={registrationStates}
				refetching={refetching}
			/>
		</HomeEventListShell>
	);
}
