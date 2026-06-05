import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware";
import { adminEventsQuerySchema } from "./schemas";

export type { EventWithRelations } from "@repo/db/queries/events";

const protectedQueryFn = createServerFn({ method: "GET" }).middleware([
	authMiddleware,
]);

export const fetchAdminEventsServer = protectedQueryFn
	.inputValidator((input: unknown) => adminEventsQuerySchema.parse(input))
	.handler(async ({ data }) => {
		const { getEvents } = await import("@repo/db/queries/events");
		return getEvents({ sortOrder: data.sortOrder });
	});

export const adminEventsQueryOptions = (sortOrder: "asc" | "desc" = "desc") =>
	queryOptions({
		queryKey: ["admin", "events", sortOrder] as const,
		queryFn: () => fetchAdminEventsServer({ data: { sortOrder } }),
	});

export const fetchAdminEventTypesServer = protectedQueryFn.handler(async () => {
	const { getEventTypes } = await import("@repo/db/queries/lookups");
	return getEventTypes();
});

export const adminEventTypesQueryOptions = queryOptions({
	queryKey: ["admin", "event-types"] as const,
	queryFn: () => fetchAdminEventTypesServer(),
});

export const fetchAdminEventLocationsServer = protectedQueryFn.handler(
	async () => {
		const { getEventLocations } = await import("@repo/db/queries/lookups");
		return getEventLocations();
	},
);

export const adminEventLocationsQueryOptions = queryOptions({
	queryKey: ["admin", "event-locations"] as const,
	queryFn: () => fetchAdminEventLocationsServer(),
});

export const fetchAdminEventFacultiesServer = protectedQueryFn.handler(
	async () => {
		const { getEventFaculties } = await import("@repo/db/queries/lookups");
		return getEventFaculties();
	},
);

export const adminEventFacultiesQueryOptions = queryOptions({
	queryKey: ["admin", "event-faculties"] as const,
	queryFn: () => fetchAdminEventFacultiesServer(),
});

export const fetchAdminEventFilterOptionsServer = protectedQueryFn.handler(
	async () => {
		const { getEventFilterOptions } = await import("@repo/db/queries/events");
		return getEventFilterOptions();
	},
);

export const adminEventFilterOptionsQueryOptions = queryOptions({
	queryKey: ["admin", "event-filter-options"] as const,
	queryFn: () => fetchAdminEventFilterOptionsServer(),
	staleTime: 60_000,
});
