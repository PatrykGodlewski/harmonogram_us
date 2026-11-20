import { getMyRegistrations } from "@repo/db/queries/event-registrations";
import {
	getEventById,
	getEventFilterOptions,
	getEventPage,
} from "@repo/db/queries/events";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentSession } from "../auth/user";
import { appError } from "../errors";
import type { EventFiltersParams } from "./schemas";
import { eventFiltersSchema, eventIdSchema } from "./schemas";

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
	.handler(async ({ data: { limit, ...filters } }) =>
		getEventPage({ ...filters, audience: "public" }, limit),
	);

/** Prefix of every event-list query, whatever the filters (for invalidation). */
export const eventsQueryKeyPrefix = ["events"] as const;

export const eventsQueryOptions = (filters: EventFiltersParams) =>
	queryOptions({
		queryKey: [...eventsQueryKeyPrefix, filters] as const,
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

export type { EventDetails } from "@repo/db/queries/events";

export const fetchEventDetailsServer = createServerFn({ method: "GET" })
	.inputValidator((input: unknown) => eventIdSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await getEventById(data.eventId, "public");
		if (!event) {
			throw appError("EVENT_NOT_FOUND");
		}
		// The meeting link is for registered people only.
		if (event.onlineUrl && !(await isRegisteredFor(event.id))) {
			return { ...event, onlineUrl: null };
		}
		return event;
	});

export const eventDetailsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["event-details", eventId] as const,
		queryFn: () => fetchEventDetailsServer({ data: { eventId } }),
		staleTime: 30_000,
	});

async function isRegisteredFor(eventId: string): Promise<boolean> {
	const session = await getCurrentSession();
	if (!session?.user) {
		return false;
	}
	const mine = await getMyRegistrations(session.user.id);
	return mine.events.some(
		(entry) => entry.eventId === eventId && entry.state === "registered",
	);
}
