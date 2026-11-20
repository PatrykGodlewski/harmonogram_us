import { missingForPublish } from "@repo/db/queries/event-completeness";
import {
	canManageEvent,
	listManagedEventIds,
} from "@repo/db/queries/event-organizers";
import { getEventRegistrants } from "@repo/db/queries/event-registrations";
import {
	getEventAccess,
	getEventById,
	getEventFilterOptions,
	getEventPage,
} from "@repo/db/queries/events";
import { listGroupsForEvent } from "@repo/db/queries/groups";
import {
	getEventFaculties,
	getEventLocations,
	getEventTypes,
} from "@repo/db/queries/lookups";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "../auth/admin-middleware";
import { assertCanCheckIn, assertCanManageEvent } from "../auth/event-access";
import { panelQueryFn } from "../auth/panel-middleware";
import { appError } from "../errors";
import {
	ADMIN_EVENT_PAGE_SIZE,
	adminEventIdSchema,
	adminEventsQuerySchema,
} from "./schemas";

export type { AgendaItem } from "@repo/db/queries/agenda-items";
export type { EventRegistrant } from "@repo/db/queries/event-registrations";
export type { EventWithRelations, FilterOption } from "@repo/db/queries/events";

/** An event as the panel's event page gets it: details plus what publishing still needs. */
export type AdminEventDetails = Awaited<
	ReturnType<typeof fetchAdminEventDetailsServer>
>;
export type { GroupSummary } from "@repo/db/queries/groups";
export type { LookupRow } from "@repo/db/queries/lookups";

const adminQueryFn = createServerFn({ method: "GET" }).middleware([
	adminMiddleware,
]);

export const fetchAdminEventsServer = panelQueryFn
	.inputValidator((input: unknown) => adminEventsQuerySchema.parse(input))
	.handler(async ({ data, context }) => {
		const [managed, managerOf] = await Promise.all([
			listManagedEventIds(context.user),
			listManagedEventIds(context.user, "manager"),
		]);
		// A page, not everything: an installation collects thousands of events.
		const page = await getEventPage(
			{
				audience: { kind: "manage" },
				sortOrder: data.sortOrder,
				...(data.search ? { search: data.search } : {}),
				...(managed === "all" ? {} : { ids: managed }),
			},
			data.limit,
		);
		// Helpers see their events but can't edit them: the list hides those actions.
		return {
			...page,
			events: page.events.map((event) => ({
				...event,
				canManage: managerOf === "all" || managerOf.includes(event.id),
			})),
		};
	});

export const adminEventsQueryOptions = (
	limit: number = ADMIN_EVENT_PAGE_SIZE,
	search = "",
	sortOrder: "asc" | "desc" = "desc",
) =>
	queryOptions({
		queryKey: ["admin", "events", sortOrder, limit, search] as const,
		queryFn: () =>
			fetchAdminEventsServer({
				data: { sortOrder, limit, ...(search ? { search } : {}) },
			}),
		// Keep the rows on screen while "show more" loads the longer page.
		placeholderData: keepPreviousData,
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

/** Lookup options for the event form: every panel user needs them. */
export const fetchAdminEventFilterOptionsServer = panelQueryFn.handler(
	async () => getEventFilterOptions(),
);

export const adminEventFilterOptionsQueryOptions = queryOptions({
	queryKey: ["admin", "event-filter-options"] as const,
	queryFn: () => fetchAdminEventFilterOptionsServer(),
	staleTime: 60_000,
});

export const fetchAdminEventDetailsServer = panelQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCheckIn(context.user, data.eventId);
		const event = await getEventById(data.eventId, { kind: "manage" });
		if (!event) {
			throw appError("NOT_FOUND");
		}
		const canManage = await canManageEvent(context.user, data.eventId);
		// The invite secret only for those who manage an invite-only event.
		const inviteToken =
			canManage && event.visibility === "private"
				? ((await getEventAccess(data.eventId))?.inviteToken ?? null)
				: null;
		// What a draft still needs before publishing, so the panel can say so up front.
		return {
			...event,
			missingForPublish: missingForPublish(event),
			inviteToken,
			// A check-in helper gets a door view: scanner and attendance only.
			access: canManage ? ("manage" as const) : ("checkin" as const),
		};
	});

export const adminEventDetailsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId] as const,
		queryFn: () => fetchAdminEventDetailsServer({ data: { eventId } }),
	});

export const fetchAdminEventRegistrantsServer = panelQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCheckIn(context.user, data.eventId);
		return getEventRegistrants(data.eventId);
	});

export const adminEventRegistrantsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "registrants"] as const,
		queryFn: () => fetchAdminEventRegistrantsServer({ data: { eventId } }),
	});

export const fetchAdminEventGroupsServer = panelQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return listGroupsForEvent(data.eventId);
	});

export const adminEventGroupsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "groups"] as const,
		queryFn: () => fetchAdminEventGroupsServer({ data: { eventId } }),
	});
