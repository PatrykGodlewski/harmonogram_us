import { getEventFilterOptions, getEvents } from "@repo/db/queries/events";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import type { EventFiltersParams } from "./schemas";
import { eventFiltersSchema } from "./schemas";

export const fetchFilterOptionsServer = createServerFn({
	method: "GET",
}).handler(async () => getEventFilterOptions());

export const eventFilterOptionsQueryOptions = queryOptions({
	queryKey: ["event-filter-options"] as const,
	queryFn: () => fetchFilterOptionsServer(),
	staleTime: 60_000,
});

export const fetchEventsServer = createServerFn({ method: "GET" })
	.inputValidator((input: unknown) => eventFiltersSchema.parse(input))
	.handler(async ({ data }) => getEvents(data));

export const eventsQueryOptions = (filters: EventFiltersParams) =>
	queryOptions({
		queryKey: ["events", filters] as const,
		queryFn: () => fetchEventsServer({ data: filters }),
		staleTime: 30_000,
		placeholderData: (previousData) => previousData,
	});

export async function prefetchEventData(
	queryClient: QueryClient,
	filters: EventFiltersParams,
) {
	await Promise.all([
		queryClient.ensureQueryData(eventFilterOptionsQueryOptions),
		queryClient.ensureQueryData(eventsQueryOptions(filters)),
	]);
}
