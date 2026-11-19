import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useRegistrationActions } from "~/lib/registration/use-registration-actions";
import type { EventDetailsRegistrations } from "./types";

/** The user's registrations on the event page and the actions to change them. */
export function useEventDetailsRegistrations(
	eventId: string,
	userId: string | undefined,
): EventDetailsRegistrations {
	const registrations = useQuery({
		...myRegistrationsQueryOptions,
		enabled: Boolean(userId),
	});
	const actions = useRegistrationActions();

	const registeredItemIds = React.useMemo(
		() => new Set(registrations.data?.agendaItemIds ?? []),
		[registrations.data],
	);

	return {
		isEventRegistered: (registrations.data?.eventIds ?? []).includes(eventId),
		registeredItemIds,
		pendingKey: actions.pendingKey,
		registerEvent: () => actions.register(eventId),
		unregisterEvent: () => actions.unregister(eventId),
		registerItem: (item) => actions.registerItem(eventId, item),
		unregisterItem: (item) => actions.unregisterItem(eventId, item),
	};
}
