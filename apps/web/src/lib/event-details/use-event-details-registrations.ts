import {
	registerForAgendaItemServer,
	registerForEventServer,
	unregisterFromAgendaItemServer,
	unregisterFromEventServer,
} from "@repo/api/events/mutations";
import {
	myRegisteredEventIdsQueryOptions,
	myRegistrationsQueryOptions,
} from "@repo/api/events/my-registrations";
import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import { agendaItemSeatCountsCollection } from "@repo/collections/agenda-item-seat-counts";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import {
	events_item_register_success,
	events_item_unregister_success,
	events_register_full,
	events_register_success,
	events_unregister_success,
} from "@repo/i18n/paraglide/messages";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";
import { showRegistrationErrorToast } from "~/lib/event-registration/errors";
import type { AgendaItemRef, EventDetailsRegistrations } from "./types";

type RegistrationAction =
	| { type: "registerEvent" }
	| { type: "unregisterEvent" }
	| { type: "registerItem"; item: AgendaItemRef }
	| { type: "unregisterItem"; item: AgendaItemRef };

function actionKey(action: RegistrationAction): string {
	return "item" in action ? `${action.type}:${action.item.id}` : action.type;
}

async function runAction(eventId: string, action: RegistrationAction) {
	switch (action.type) {
		case "registerEvent":
			return registerForEventServer({ data: { eventId } });
		case "unregisterEvent":
			return unregisterFromEventServer({ data: { eventId } });
		case "registerItem":
			return registerForAgendaItemServer({
				data: { agendaItemId: action.item.id },
			});
		case "unregisterItem":
			return unregisterFromAgendaItemServer({
				data: { agendaItemId: action.item.id },
			});
	}
}

function successMessage(action: RegistrationAction): string {
	switch (action.type) {
		case "registerEvent":
			return events_register_success();
		case "unregisterEvent":
			return events_unregister_success();
		case "registerItem":
			return events_item_register_success({ title: action.item.title });
		case "unregisterItem":
			return events_item_unregister_success({ title: action.item.title });
	}
}

type MyRegistrations = { eventIds: string[]; agendaItemIds: string[] };

/** The registrations the user has after `action` succeeds. */
function applyAction(
	current: MyRegistrations,
	eventId: string,
	action: RegistrationAction,
	agendaItemIdsOfEvent: ReadonlySet<string>,
): MyRegistrations {
	const without = <T>(list: T[], value: T) => list.filter((v) => v !== value);
	const withValue = <T>(list: T[], value: T) =>
		list.includes(value) ? list : [...list, value];

	switch (action.type) {
		case "registerEvent":
			return { ...current, eventIds: withValue(current.eventIds, eventId) };
		case "unregisterEvent":
			return {
				eventIds: without(current.eventIds, eventId),
				agendaItemIds: current.agendaItemIds.filter(
					(id) => !agendaItemIdsOfEvent.has(id),
				),
			};
		case "registerItem":
			return {
				eventIds: withValue(current.eventIds, eventId),
				agendaItemIds: withValue(current.agendaItemIds, action.item.id),
			};
		case "unregisterItem":
			return {
				...current,
				agendaItemIds: without(current.agendaItemIds, action.item.id),
			};
	}
}

/**
 * Waits until Electric delivers this transaction on the collection the action
 * always changes, so live counts match before the button settles. Waiting on a
 * collection the transaction didn't touch would only end at the timeout.
 */
async function awaitSeatCounts(
	action: RegistrationAction,
	txid: number | undefined,
) {
	if (typeof txid !== "number") {
		return;
	}
	const collection =
		action.type === "registerItem" || action.type === "unregisterItem"
			? agendaItemSeatCountsCollection
			: eventSeatCountsCollection;
	await collection.utils.awaitTxId(txid).catch(() => {});
}

export function useEventDetailsRegistrations(
	eventId: string,
	userId: string | undefined,
	agendaItemIds: readonly string[],
): EventDetailsRegistrations {
	const queryClient = useQueryClient();
	const registrations = useQuery({
		...myRegistrationsQueryOptions,
		enabled: Boolean(userId),
	});

	const mutation = useMutation({
		mutationFn: (action: RegistrationAction) => runAction(eventId, action),
		onSuccess: async (result, action) => {
			toast.success(successMessage(action));
			queryClient.setQueryData<MyRegistrations>(
				myRegistrationsQueryOptions.queryKey,
				(current) =>
					applyAction(
						current ?? { eventIds: [], agendaItemIds: [] },
						eventId,
						action,
						new Set(agendaItemIds),
					),
			);
			await awaitSeatCounts(action, result?.txid);
		},
		onError: (error) => {
			showRegistrationErrorToast(error, events_register_full);
		},
		onSettled: () =>
			Promise.all([
				queryClient.invalidateQueries({
					queryKey: myRegistrationsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: myRegisteredEventIdsQueryOptions.queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: eventDetailsQueryOptions(eventId).queryKey,
				}),
			]),
	});

	const registeredItemIds = React.useMemo(
		() => new Set(registrations.data?.agendaItemIds ?? []),
		[registrations.data],
	);

	const run = (action: RegistrationAction) => {
		if (!mutation.isPending) {
			mutation.mutate(action);
		}
	};

	return {
		isEventRegistered: (registrations.data?.eventIds ?? []).includes(eventId),
		registeredItemIds,
		pendingKey:
			mutation.isPending && mutation.variables
				? actionKey(mutation.variables)
				: null,
		registerEvent: () => run({ type: "registerEvent" }),
		unregisterEvent: () => run({ type: "unregisterEvent" }),
		registerItem: (item) => run({ type: "registerItem", item }),
		unregisterItem: (item) => run({ type: "unregisterItem", item }),
	};
}
