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
import {
	eventDetailsQueryOptions,
	eventsQueryKeyPrefix,
} from "@repo/api/events/queries";
import { agendaItemSeatCountsCollection } from "@repo/collections/agenda-item-seat-counts";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import {
	events_item_register_success,
	events_item_unregister_success,
	events_register_full,
	events_register_success,
	events_unregister_success,
} from "@repo/i18n/paraglide/messages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showRegistrationErrorToast } from "~/lib/event-registration/errors";

export type AgendaItemTarget = { id: string; title: string };

type RegistrationAction =
	| { type: "register"; eventId: string }
	| { type: "unregister"; eventId: string }
	| { type: "registerItem"; eventId: string; item: AgendaItemTarget }
	| { type: "unregisterItem"; eventId: string; item: AgendaItemTarget };

export type RegistrationActions = {
	register: (eventId: string) => void;
	unregister: (eventId: string) => void;
	registerItem: (eventId: string, item: AgendaItemTarget) => void;
	unregisterItem: (eventId: string, item: AgendaItemTarget) => void;
	/** Key of the action in flight: `register:<eventId>`, `unregister:<eventId>`, `registerItem:<itemId>`, `unregisterItem:<itemId>`. */
	pendingKey: string | null;
};

function actionKey(action: RegistrationAction): string {
	return "item" in action
		? `${action.type}:${action.item.id}`
		: `${action.type}:${action.eventId}`;
}

function runAction(action: RegistrationAction) {
	switch (action.type) {
		case "register":
			return registerForEventServer({ data: { eventId: action.eventId } });
		case "unregister":
			return unregisterFromEventServer({ data: { eventId: action.eventId } });
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
		case "register":
			return events_register_success();
		case "unregister":
			return events_unregister_success();
		case "registerItem":
			return events_item_register_success({ title: action.item.title });
		case "unregisterItem":
			return events_item_unregister_success({ title: action.item.title });
	}
}

/** Electric did not confirm the transaction in time, or the stream closed (page left). */
function isSyncUnconfirmed(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === "TimeoutWaitingForTxIdError" ||
			error.name === "StreamAbortedError")
	);
}

/**
 * The one registration flow for every screen: call the server, wait until
 * Electric delivers the transaction on the collection the action changes, then
 * refresh the user's registrations. If Electric does not confirm in time, the
 * data is fetched again from the server instead.
 */
export function useRegistrationActions(): RegistrationActions {
	const queryClient = useQueryClient();

	const refreshKeys = (eventId: string) => [
		myRegistrationsQueryOptions.queryKey,
		myRegisteredEventIdsQueryOptions.queryKey,
		eventDetailsQueryOptions(eventId).queryKey,
		eventsQueryKeyPrefix,
	];

	const mutation = useMutation({
		mutationFn: runAction,
		onSuccess: async (result, action) => {
			toast.success(successMessage(action));
			const collection =
				action.type === "registerItem" || action.type === "unregisterItem"
					? agendaItemSeatCountsCollection
					: eventSeatCountsCollection;
			try {
				await collection.utils.awaitTxId(result.txid);
			} catch (error) {
				if (!isSyncUnconfirmed(error)) {
					throw error;
				}
				await Promise.all(
					refreshKeys(action.eventId).map((queryKey) =>
						queryClient.refetchQueries({ queryKey }),
					),
				);
			}
		},
		onError: (error) => {
			showRegistrationErrorToast(error, events_register_full);
		},
		onSettled: (_result, _error, action) =>
			Promise.all(
				refreshKeys(action.eventId).map((queryKey) =>
					queryClient.invalidateQueries({ queryKey }),
				),
			),
	});

	const run = (action: RegistrationAction) => {
		if (!mutation.isPending) {
			mutation.mutate(action);
		}
	};

	return {
		register: (eventId) => run({ type: "register", eventId }),
		unregister: (eventId) => run({ type: "unregister", eventId }),
		registerItem: (eventId, item) =>
			run({ type: "registerItem", eventId, item }),
		unregisterItem: (eventId, item) =>
			run({ type: "unregisterItem", eventId, item }),
		pendingKey:
			mutation.isPending && mutation.variables
				? actionKey(mutation.variables)
				: null,
	};
}
