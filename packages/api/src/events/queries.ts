import { isRegisteredForEvent } from "@repo/db/queries/event-registrations";
import {
	getEventById,
	getEventFilterOptions,
	getEventOnlineUrl,
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
	.handler(async ({ data: { limit, ...filters } }) => {
		const session = await getCurrentSession();
		return getEventPage(
			{
				...filters,
				audience: { kind: "public", signedIn: Boolean(session?.user) },
			},
			limit,
		);
	});

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
		const session = await getCurrentSession();
		const signedIn = Boolean(session?.user);
		const event = await getEventById(data.eventId, {
			kind: "public",
			signedIn,
		});
		if (!event) {
			// A signed-in-only event asks an anonymous visitor to sign in (the page redirects).
			if (
				!signedIn &&
				(await getEventById(data.eventId, { kind: "public", signedIn: true }))
			) {
				throw appError("UNAUTHORIZED");
			}
			throw appError("EVENT_NOT_FOUND");
		}
		// The public read never carries the meeting link; registered people get it here.
		if (
			event.attendanceMode !== "onsite" &&
			session?.user &&
			(await isRegisteredForEvent(event.id, session.user.id))
		) {
			return { ...event, onlineUrl: await getEventOnlineUrl(event.id) };
		}
		return event;
	});

export const eventDetailsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["event-details", eventId] as const,
		queryFn: () => fetchEventDetailsServer({ data: { eventId } }),
		staleTime: 30_000,
	});
