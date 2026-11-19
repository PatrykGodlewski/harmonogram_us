import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";

export type EventRegistrationState = {
	state: "registered" | "waitlisted";
	/** 1-based place on the waitlist; null when registered. */
	waitlistPosition: number | null;
};

export type MyRegistrationsView = {
	byEvent: ReadonlyMap<string, EventRegistrationState>;
	agendaItemIds: ReadonlySet<string>;
};

/** The signed-in user's registrations, indexed for lookups (one query for every screen). */
export function useMyRegistrations(
	userId: string | undefined,
): MyRegistrationsView {
	const query = useQuery({
		...myRegistrationsQueryOptions,
		enabled: Boolean(userId),
	});
	return React.useMemo(
		() => ({
			byEvent: new Map(
				(query.data?.events ?? []).map((row) => [
					row.eventId,
					{ state: row.state, waitlistPosition: row.waitlistPosition },
				]),
			),
			agendaItemIds: new Set(query.data?.agendaItemIds ?? []),
		}),
		[query.data],
	);
}
