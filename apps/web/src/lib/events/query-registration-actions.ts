import type {
	EventRegistrationActions,
	RegistrationStates,
} from "~/lib/registration/use-event-list-registrations";

/** Read-only actions for the server-rendered list (before the live list takes over). */
export function createQueryRegistrationActions(
	states: RegistrationStates,
): EventRegistrationActions {
	return {
		isRegistered: (eventId) => states.get(eventId)?.state === "registered",
		waitlistPosition: (eventId) =>
			states.get(eventId)?.waitlistPosition ?? null,
		isRegisterPending: () => false,
		isUnregisterPending: () => false,
		register: () => {},
		unregister: () => {},
	};
}
