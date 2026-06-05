import { myRegisteredEventIdsQueryOptions } from "@repo/api/events/my-registrations";
import type { QueryClient } from "@tanstack/react-query";

export function readRegisteredEventIds(queryClient: QueryClient): string[] {
	return (
		queryClient.getQueryData<string[]>(
			myRegisteredEventIdsQueryOptions.queryKey,
		) ?? []
	);
}

export function writeRegisteredEventIds(
	queryClient: QueryClient,
	updater: (current: string[]) => string[],
) {
	queryClient.setQueryData<string[]>(
		myRegisteredEventIdsQueryOptions.queryKey,
		(current) => updater(current ?? []),
	);
}

export function addRegisteredEventId(
	queryClient: QueryClient,
	eventId: string,
) {
	writeRegisteredEventIds(queryClient, (ids) =>
		ids.includes(eventId) ? ids : [...ids, eventId],
	);
}

export function removeRegisteredEventId(
	queryClient: QueryClient,
	eventId: string,
) {
	writeRegisteredEventIds(queryClient, (ids) =>
		ids.filter((id) => id !== eventId),
	);
}

export function applyRemoteRegistrationState(
	queryClient: QueryClient,
	eventId: string,
	registered: boolean,
) {
	writeRegisteredEventIds(queryClient, (ids) => {
		if (registered) {
			return ids.includes(eventId) ? ids : [...ids, eventId];
		}
		return ids.filter((id) => id !== eventId);
	});
}

export async function snapshotRegisteredEventIds(queryClient: QueryClient) {
	await queryClient.cancelQueries({
		queryKey: myRegisteredEventIdsQueryOptions.queryKey,
	});
	return readRegisteredEventIds(queryClient);
}

export function restoreRegisteredEventIds(
	queryClient: QueryClient,
	previousRegisteredIds: string[] | undefined,
) {
	if (previousRegisteredIds === undefined) {
		return;
	}

	queryClient.setQueryData(
		myRegisteredEventIdsQueryOptions.queryKey,
		previousRegisteredIds,
	);
}

export function invalidateRegisteredEventIds(queryClient: QueryClient) {
	return queryClient.invalidateQueries({
		queryKey: myRegisteredEventIdsQueryOptions.queryKey,
	});
}
