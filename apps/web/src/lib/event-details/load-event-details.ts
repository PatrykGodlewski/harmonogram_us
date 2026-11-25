import {
	type EventDetails,
	eventDetailsQueryOptions,
} from "@repo/api/events/queries";
import type { QueryClient } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";

/**
 * The event page's data for a loader: a deleted or unknown event is a 404 page, a
 * signed-in-only one sends to sign-in and back to `returnTo`.
 */
export async function loadEventDetails(
	queryClient: QueryClient,
	eventId: string,
	invite: string | undefined,
	returnTo: string,
): Promise<EventDetails> {
	try {
		return await queryClient.ensureQueryData(
			eventDetailsQueryOptions(eventId, invite),
		);
	} catch (error) {
		if (error instanceof Error && error.message === "EVENT_NOT_FOUND") {
			throw notFound();
		}
		if (error instanceof Error && error.message === "UNAUTHORIZED") {
			throw redirect({
				to: "/login",
				search: { redirect: returnTo, event: eventId, invite },
			});
		}
		throw error;
	}
}
