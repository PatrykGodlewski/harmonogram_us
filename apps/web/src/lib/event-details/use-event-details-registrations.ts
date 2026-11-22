import { approvalOf } from "~/lib/registration/approval";
import { useMyRegistrations } from "~/lib/registration/use-my-registrations";
import { useRegistrationActions } from "~/lib/registration/use-registration-actions";
import type { EventDetailsRegistrations } from "./types";

/** The user's registrations on the event page and the actions to change them. */
export function useEventDetailsRegistrations(
	eventId: string,
	userId: string | undefined,
): EventDetailsRegistrations {
	const { byEvent, agendaItemIds } = useMyRegistrations(userId);
	const actions = useRegistrationActions();
	const mine = byEvent.get(eventId);

	return {
		isEventRegistered: mine?.state === "registered",
		registeredItemIds: agendaItemIds,
		waitlistPosition: mine?.waitlistPosition ?? null,
		approval: approvalOf(mine?.state),
		isBusy: actions.hasPending,
		registerEvent: (answers) => actions.register(eventId, answers),
		unregisterEvent: () => actions.unregister(eventId),
		registerItem: (item) => actions.registerItem(eventId, item),
		unregisterItem: (item) => actions.unregisterItem(eventId, item),
	};
}
