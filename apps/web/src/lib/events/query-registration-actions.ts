import type { EventRegistrationActions } from "~/lib/registration/use-event-list-registrations";

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
