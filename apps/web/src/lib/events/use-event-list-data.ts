import { eventsQueryOptions } from "@repo/api/events/queries";
import type { EventFiltersParams } from "@repo/api/events/schemas";
import { useQuery } from "@tanstack/react-query";
import { useRegistrationStates } from "~/lib/registration/use-event-list-registrations";

type UseEventListDataOptions = {
	filters: EventFiltersParams;
	userId: string | undefined;
};

export function useEventListData({ filters, userId }: UseEventListDataOptions) {
	const eventsQuery = useQuery(eventsQueryOptions(filters));
	const registrationStates = useRegistrationStates(userId);

	// Prefer loader-dehydrated data on SSR; only skeleton when there is no cached data yet.
	const loading = eventsQuery.isPending && eventsQuery.data === undefined;
	const refetching =
		eventsQuery.isFetching && eventsQuery.data !== undefined && !loading;

	return {
		events: eventsQuery.data ?? [],
		error: eventsQuery.error,
		isError: eventsQuery.isError,
		loading,
		refetching,
		registrationStates,
	};
}
