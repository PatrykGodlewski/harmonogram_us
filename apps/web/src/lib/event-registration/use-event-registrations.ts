import {
	registerForEventServer,
	unregisterFromEventServer,
} from "@repo/api/events/mutations";
import { myRegisteredEventIdsQueryOptions } from "@repo/api/events/my-registrations";
import type { EventFiltersParams } from "@repo/api/events/schemas";
import {
	events_register_full,
	events_register_success,
	events_unregister_not_registered,
	events_unregister_success,
} from "@repo/i18n/paraglide/messages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { reconcileRemoteSeatCountChange } from "~/lib/events/seat-count";
import type { useEventSeatCounts } from "~/lib/events/use-event-seat-counts";
import { subscribeRegistrationChanges } from "./cross-tab";
import {
	addRegisteredEventId,
	applyRemoteRegistrationState,
	removeRegisteredEventId,
} from "./registered-events-cache";
import type {
	EventRegistrationActions,
	RegistrationChangeMessage,
} from "./types";
import { useInFlightActions } from "./use-in-flight-actions";
import { useRegistrationMutation } from "./use-registration-mutation";

type UseEventRegistrationsOptions = {
	filters: EventFiltersParams;
	userId: string | undefined;
	seatCounts: ReturnType<typeof useEventSeatCounts>;
};

function inFlightKey(action: "register" | "unregister", eventId: string) {
	return `${action}:${eventId}`;
}

export function useEventRegistrations({
	filters,
	userId,
	seatCounts,
}: UseEventRegistrationsOptions): EventRegistrationActions {
	const queryClient = useQueryClient();
	const { adjust, clear } = seatCounts;
	const inFlight = useInFlightActions();

	const registrationsQuery = useQuery({
		...myRegisteredEventIdsQueryOptions,
		enabled: Boolean(userId),
	});

	const registeredEventIds = React.useMemo(
		() => new Set(registrationsQuery.data ?? []),
		[registrationsQuery.data],
	);

	const registerMutation = useRegistrationMutation(
		{
			mutationFn: (eventId) => registerForEventServer({ data: { eventId } }),
			seatDelta: -1,
			registered: true,
			successToast: events_register_success,
			fallbackErrorMessage: events_register_full,
			assertCanMutate: (registeredIds, eventId) => {
				if (registeredIds.includes(eventId)) {
					throw new Error("ALREADY_REGISTERED");
				}
			},
			applyOptimisticRegistration: (eventId) => {
				addRegisteredEventId(queryClient, eventId);
			},
		},
		filters,
		seatCounts,
	);

	const unregisterMutation = useRegistrationMutation(
		{
			mutationFn: (eventId) => unregisterFromEventServer({ data: { eventId } }),
			seatDelta: 1,
			registered: false,
			successToast: events_unregister_success,
			fallbackErrorMessage: events_unregister_not_registered,
			assertCanMutate: () => {},
			applyOptimisticRegistration: (eventId) => {
				removeRegisteredEventId(queryClient, eventId);
			},
		},
		filters,
		seatCounts,
	);

	const handleRemoteRegistrationChange = React.useCallback(
		(message: RegistrationChangeMessage) => {
			adjust(message.eventId, message.seatDelta);

			if (typeof message.registered === "boolean") {
				applyRemoteRegistrationState(
					queryClient,
					message.eventId,
					message.registered,
				);
			}

			void reconcileRemoteSeatCountChange(
				queryClient,
				filters,
				message.txid,
			).finally(() => {
				clear(message.eventId);
			});
		},
		[adjust, clear, filters, queryClient],
	);

	React.useEffect(() => {
		return subscribeRegistrationChanges(handleRemoteRegistrationChange);
	}, [handleRemoteRegistrationChange]);

	const isPending = React.useCallback(
		(
			action: "register" | "unregister",
			eventId: string,
			mutation: { isPending: boolean; variables?: string },
		) => {
			const key = inFlightKey(action, eventId);
			return (
				(mutation.isPending && mutation.variables === eventId) ||
				inFlight.isInFlight(key)
			);
		},
		[inFlight],
	);

	return {
		isRegistered: (eventId) => registeredEventIds.has(eventId),
		isRegisterPending: (eventId) =>
			isPending("register", eventId, registerMutation),
		isUnregisterPending: (eventId) =>
			isPending("unregister", eventId, unregisterMutation),
		register: (eventId) => {
			if (registeredEventIds.has(eventId)) {
				return;
			}

			const key = inFlightKey("register", eventId);
			inFlight.runExclusive(key, () => {
				registerMutation.mutate(eventId, {
					onSettled: () => {
						inFlight.finish(key);
					},
				});
			});
		},
		unregister: (eventId) => {
			const key = inFlightKey("unregister", eventId);
			inFlight.runExclusive(key, () => {
				unregisterMutation.mutate(eventId, {
					onSettled: () => {
						inFlight.finish(key);
					},
				});
			});
		},
	};
}
