import {
	getMyRegistrationStates,
	getMyRegistrations,
	type MyRegistrationState,
} from "@repo/db/queries/event-registrations";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../auth/user";

export const fetchMyRegistrationStatesServer = createServerFn({
	method: "GET",
}).handler(async (): Promise<MyRegistrationState[]> => {
	const user = await getCurrentUser();
	if (!user) return [];

	return getMyRegistrationStates(user.id);
});

/** Per event: registered or waitlisted (with position). */
export const myRegistrationStatesQueryOptions = queryOptions({
	queryKey: ["my-registration-states"] as const,
	queryFn: () => fetchMyRegistrationStatesServer(),
	staleTime: 30_000,
});

export function ensureMyRegistrationStates(queryClient: QueryClient) {
	return queryClient.ensureQueryData({
		...myRegistrationStatesQueryOptions,
		revalidateIfStale: true,
	});
}

export const fetchMyRegistrationsServer = createServerFn({
	method: "GET",
}).handler(async () => {
	const user = await getCurrentUser();
	if (!user) return { eventIds: [], agendaItemIds: [], waitlist: [] };

	return getMyRegistrations(user.id);
});

export const myRegistrationsQueryOptions = queryOptions({
	queryKey: ["my-registrations"] as const,
	queryFn: () => fetchMyRegistrationsServer(),
	staleTime: 30_000,
});
