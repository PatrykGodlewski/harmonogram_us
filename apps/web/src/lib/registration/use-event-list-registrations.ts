import { myRegisteredEventIdsQueryOptions } from "@repo/api/events/my-registrations";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useRegistrationActions } from "./use-registration-actions";

export type EventRegistrationActions = {
	isRegistered: (eventId: string) => boolean;
	isRegisterPending: (eventId: string) => boolean;
	isUnregisterPending: (eventId: string) => boolean;
	register: (eventId: string) => void;
	unregister: (eventId: string) => void;
};

/** Registration state and actions for the event list. */
export function useEventListRegistrations(
	userId: string | undefined,
): EventRegistrationActions {
	const registrations = useQuery({
		...myRegisteredEventIdsQueryOptions,
		enabled: Boolean(userId),
	});
	const actions = useRegistrationActions();
	const registered = React.useMemo(
		() => new Set(registrations.data ?? []),
		[registrations.data],
	);

	return {
		isRegistered: (eventId) => registered.has(eventId),
		isRegisterPending: (eventId) =>
			actions.pendingKey === `register:${eventId}`,
		isUnregisterPending: (eventId) =>
			actions.pendingKey === `unregister:${eventId}`,
		register: actions.register,
		unregister: actions.unregister,
	};
}
