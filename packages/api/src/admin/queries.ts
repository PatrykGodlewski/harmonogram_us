import { getEventRegistrants } from "@repo/db/queries/event-registrations";
import {
	getEventById,
	getEventFilterOptions,
	getEvents,
} from "@repo/db/queries/events";
import { listGroupsForEvent } from "@repo/db/queries/groups";
import {
	getEventFaculties,
	getEventLocations,
	getEventTypes,
} from "@repo/db/queries/lookups";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "../auth/admin-middleware";
import { appError } from "../errors";
import { adminEventIdSchema, adminEventsQuerySchema } from "./schemas";

export type { AgendaItem } from "@repo/db/queries/agenda-items";
export type { EventRegistrant } from "@repo/db/queries/event-registrations";
export type {
	EventDetails,
	EventWithRelations,
	FilterOption,
} from "@repo/db/queries/events";
export type { GroupSummary } from "@repo/db/queries/groups";
export type { LookupRow } from "@repo/db/queries/lookups";

const adminQueryFn = createServerFn({ method: "GET" }).middleware([
	adminMiddleware,
]);

export const fetchAdminEventsServer = adminQueryFn
	.inputValidator((input: unknown) => adminEventsQuerySchema.parse(input))
	.handler(async ({ data }) => getEvents({ sortOrder: data.sortOrder }));

export const adminEventsQueryOptions = (sortOrder: "asc" | "desc" = "desc") =>
	queryOptions({
		queryKey: ["admin", "events", sortOrder] as const,
		queryFn: () => fetchAdminEventsServer({ data: { sortOrder } }),
	});

export const fetchAdminEventTypesServer = adminQueryFn.handler(async () =>
	getEventTypes(),
);

export const adminEventTypesQueryOptions = queryOptions({
	queryKey: ["admin", "event-types"] as const,
	queryFn: () => fetchAdminEventTypesServer(),
});

export const fetchAdminEventLocationsServer = adminQueryFn.handler(async () =>
	getEventLocations(),
);

export const adminEventLocationsQueryOptions = queryOptions({
	queryKey: ["admin", "event-locations"] as const,
	queryFn: () => fetchAdminEventLocationsServer(),
});

export const fetchAdminEventFacultiesServer = adminQueryFn.handler(async () =>
	getEventFaculties(),
);

export const adminEventFacultiesQueryOptions = queryOptions({
	queryKey: ["admin", "event-faculties"] as const,
	queryFn: () => fetchAdminEventFacultiesServer(),
});

export const fetchAdminEventFilterOptionsServer = adminQueryFn.handler(
	async () => getEventFilterOptions(),
);

export const adminEventFilterOptionsQueryOptions = queryOptions({
	queryKey: ["admin", "event-filter-options"] as const,
	queryFn: () => fetchAdminEventFilterOptionsServer(),
	staleTime: 60_000,
});

export const fetchAdminEventDetailsServer = adminQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await getEventById(data.eventId);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const adminEventDetailsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId] as const,
		queryFn: () => fetchAdminEventDetailsServer({ data: { eventId } }),
	});

export const fetchAdminEventRegistrantsServer = adminQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data }) => getEventRegistrants(data.eventId));

export const adminEventRegistrantsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "registrants"] as const,
		queryFn: () => fetchAdminEventRegistrantsServer({ data: { eventId } }),
	});

export const fetchAdminEventGroupsServer = adminQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data }) => listGroupsForEvent(data.eventId));

export const adminEventGroupsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "groups"] as const,
		queryFn: () => fetchAdminEventGroupsServer({ data: { eventId } }),
	});
