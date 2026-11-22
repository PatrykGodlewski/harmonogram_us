import type { EventFiltersParams } from "@repo/api/events/schemas";
import { HomeEventCards } from "~/components/home-event-card";
import { HomeEventListShell } from "~/components/home-event-list-shell";
import { createQueryRegistrationActions } from "~/lib/events/query-registration-actions";
import { useEventListData } from "~/lib/events/use-event-list-data";

export type HomeEventListProps = {
	filters: EventFiltersParams;
	user: { id: string; email: string } | null;
};

/** Server-rendered list: loader data and the query cache, no registration actions. */
export function HomeEventList({ filters, user }: HomeEventListProps) {
	const {
		events,
		hasMore,
		error,
		isError,
		loading,
		refetching,
		registrationStates,
	} = useEventListData({ filters, userId: user?.id });

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
				user={user}
				refetching={refetching}
				interactive={false}
				registrations={createQueryRegistrationActions(registrationStates)}
			/>
		</HomeEventListShell>
	);
}
