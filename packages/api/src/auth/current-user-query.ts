import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "./user";

export const fetchCurrentUserServer = createServerFn({ method: "GET" }).handler(
	async () => getCurrentUser(),
);

export const currentUserQueryOptions = queryOptions({
	queryKey: ["current-user"] as const,
	queryFn: () => fetchCurrentUserServer(),
	staleTime: 60_000,
});

export function ensureCurrentUser(queryClient: QueryClient) {
	return queryClient.ensureQueryData({
		...currentUserQueryOptions,
		revalidateIfStale: true,
	});
}
