import { myRegistrationStatesQueryOptions } from "@repo/api/events/my-registrations";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useRegistrationActions } from "./use-registration-actions";

export type EventRegistrationActions = {
	isRegistered: (eventId: string) => boolean;
	/** 1-based waitlist position, or null when not waitlisted. */
	waitlistPosition: (eventId: string) => number | null;
	isRegisterPending: (eventId: string) => boolean;
	isUnregisterPending: (eventId: string) => boolean;
	register: (eventId: string) => void;
	unregister: (eventId: string) => void;
};

export type RegistrationStates = ReadonlyMap<
	string,
	{ state: "registered" | "waitlisted"; waitlistPosition: number | null }
>;

/** Registration state and actions for the event list. */
export function useEventListRegistrations(
	userId: string | undefined,
): EventRegistrationActions {
	const states = useRegistrationStates(userId);
	const actions = useRegistrationActions();

	return {
		isRegistered: (eventId) => states.get(eventId)?.state === "registered",
		waitlistPosition: (eventId) =>
			states.get(eventId)?.waitlistPosition ?? null,
		isRegisterPending: (eventId) =>
			actions.pendingKey === `register:${eventId}`,
		isUnregisterPending: (eventId) =>
			actions.pendingKey === `unregister:${eventId}`,
		register: actions.register,
		unregister: actions.unregister,
	};
}

/** The signed-in user's registration state per event. */
export function useRegistrationStates(
	userId: string | undefined,
): RegistrationStates {
	const query = useQuery({
		...myRegistrationStatesQueryOptions,
		enabled: Boolean(userId),
	});
	return React.useMemo(
		() =>
			new Map(
				(query.data ?? []).map((row) => [
					row.eventId,
					{ state: row.state, waitlistPosition: row.waitlistPosition },
				]),
			),
		[query.data],
	);
}
