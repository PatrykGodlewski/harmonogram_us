import type { EventRegistrationActions } from "~/lib/event-registration/types";

export function createQueryRegistrationActions(
	registeredEventIds: Set<string>,
): EventRegistrationActions {
	return {
		isRegistered: (eventId) => registeredEventIds.has(eventId),
		isRegisterPending: () => false,
		isUnregisterPending: () => false,
		register: () => {},
		unregister: () => {},
	};
}
