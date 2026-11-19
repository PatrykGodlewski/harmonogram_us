import type { EventRegistrationState } from "./use-my-registrations";
import { useMyRegistrations } from "./use-my-registrations";
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

export type RegistrationStates = ReadonlyMap<string, EventRegistrationState>;

/** Registration state and actions for the event list. */
export function useEventListRegistrations(
	userId: string | undefined,
): EventRegistrationActions {
	const { byEvent } = useMyRegistrations(userId);
	const actions = useRegistrationActions();

	return {
		isRegistered: (eventId) => byEvent.get(eventId)?.state === "registered",
		waitlistPosition: (eventId) =>
			byEvent.get(eventId)?.waitlistPosition ?? null,
		isRegisterPending: (eventId) => actions.isPending(`register:${eventId}`),
		isUnregisterPending: (eventId) =>
			actions.isPending(`unregister:${eventId}`),
		register: actions.register,
		unregister: actions.unregister,
	};
}
