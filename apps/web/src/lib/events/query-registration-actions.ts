import type { EventRegistrationActions } from "~/lib/registration/use-event-list-registrations";
import type { MyRegistrationsView } from "~/lib/registration/use-my-registrations";

/** Read-only actions for the server-rendered list (before the live list takes over). */
export function createQueryRegistrationActions(
	states: MyRegistrationsView["byEvent"],
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
