import { getRegisteredEventIdsForUser } from "@repo/db/queries/event-registrations";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../auth/user";

export const fetchMyRegisteredEventIdsServer = createServerFn({
	method: "GET",
}).handler(async () => {
	const user = await getCurrentUser();
	if (!user) return [];

	return getRegisteredEventIdsForUser(user.id);
});

export const myRegisteredEventIdsQueryOptions = queryOptions({
	queryKey: ["my-registered-event-ids"] as const,
	queryFn: () => fetchMyRegisteredEventIdsServer(),
	staleTime: 30_000,
});

export function ensureMyRegisteredEventIds(queryClient: QueryClient) {
	return queryClient.ensureQueryData({
		...myRegisteredEventIdsQueryOptions,
		revalidateIfStale: true,
	});
}
