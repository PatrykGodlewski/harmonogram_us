import {
	getMyRegistrations,
	type MyRegistrations,
} from "@repo/db/queries/event-registrations";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../auth/user";
import { LIVE_REFRESH_MS } from "./live-refresh";

const NONE: MyRegistrations = { events: [], agendaItemIds: [] };

export const fetchMyRegistrationsServer = createServerFn({
	method: "GET",
}).handler(async (): Promise<MyRegistrations> => {
	const user = await getCurrentUser();
	return user ? getMyRegistrations(user.id) : NONE;
});

/** The signed-in user's registrations: per event (registered / waitlisted with position) and agenda items. */
export const myRegistrationsQueryOptions = queryOptions({
	queryKey: ["my-registrations"] as const,
	queryFn: () => fetchMyRegistrationsServer(),
	staleTime: 30_000,
	// Polls only while the user waits on a waitlist: a promotion happens in someone else's action.
	refetchInterval: (query) =>
		query.state.data?.events.some((entry) => entry.state === "waitlisted")
			? LIVE_REFRESH_MS
			: false,
});

export function ensureMyRegistrations(queryClient: QueryClient) {
	return queryClient.ensureQueryData({
		...myRegistrationsQueryOptions,
		revalidateIfStale: true,
	});
}
