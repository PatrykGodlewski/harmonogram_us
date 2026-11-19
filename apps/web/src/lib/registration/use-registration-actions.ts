import {
	registerForAgendaItemServer,
	registerForEventServer,
	unregisterFromAgendaItemServer,
	unregisterFromEventServer,
} from "@repo/api/events/mutations";
import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import {
	eventDetailsQueryOptions,
	eventsQueryKeyPrefix,
} from "@repo/api/events/queries";
import { agendaItemSeatCountsCollection } from "@repo/collections/agenda-item-seat-counts";
import { eventSeatCountsCollection } from "@repo/collections/event-seat-counts";
import {
	events_item_register_success,
	events_item_unregister_success,
	events_join_waitlist_success,
	events_register_full,
	events_register_success,
	events_unregister_success,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
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
	/** Whether this action is in flight. Keys: `register:<eventId>`, `unregister:<eventId>`, `registerItem:<itemId>`, `unregisterItem:<itemId>`. */
	isPending: (key: string) => boolean;
	/** Whether any action is in flight. */
	hasPending: boolean;
};

function actionKey(action: RegistrationAction): string {
	return "item" in action
		? `${action.type}:${action.item.id}`
		: `${action.type}:${action.eventId}`;
}

function runAction(action: RegistrationAction) {
	switch (action.type) {
		case "register":
			return registerForEventServer({
				data: { eventId: action.eventId, locale: getLocale() },
			});
		case "unregister":
			return unregisterFromEventServer({ data: { eventId: action.eventId } });
		case "registerItem":
			return registerForAgendaItemServer({
				data: { agendaItemId: action.item.id, locale: getLocale() },
			});
		case "unregisterItem":
			return unregisterFromAgendaItemServer({
				data: { agendaItemId: action.item.id },
			});
	}
}

function successMessage(
	action: RegistrationAction,
	result: Awaited<ReturnType<typeof runAction>>,
): string {
	switch (action.type) {
		case "register":
			return "state" in result && result.state === "waitlisted"
				? events_join_waitlist_success()
				: events_register_success();
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
	// Actions on different events (or items) run side by side; a repeat of the same one is ignored.
	const [pending, setPending] = React.useState<ReadonlySet<string>>(new Set());
	const finish = (key: string) =>
		setPending((current) => {
			const next = new Set(current);
			next.delete(key);
			return next;
		});

	const refreshKeys = (eventId: string) => [
		myRegistrationsQueryOptions.queryKey,
		eventDetailsQueryOptions(eventId).queryKey,
		eventsQueryKeyPrefix,
	];

	/** Runs one action end to end; actions with different keys run side by side. */
	const execute = async (action: RegistrationAction) => {
		try {
			const result = await runAction(action);
			toast.success(successMessage(action, result));
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
			}
		} catch (error) {
			showRegistrationErrorToast(error, events_register_full);
		} finally {
			finish(actionKey(action));
			await Promise.all(
				refreshKeys(action.eventId).map((queryKey) =>
					queryClient.invalidateQueries({ queryKey }),
				),
			);
		}
	};

	const run = (action: RegistrationAction) => {
		const key = actionKey(action);
		if (pending.has(key)) {
			return;
		}
		setPending((current) => new Set(current).add(key));
		void execute(action);
	};

	return {
		register: (eventId) => run({ type: "register", eventId }),
		unregister: (eventId) => run({ type: "unregister", eventId }),
		registerItem: (eventId, item) =>
			run({ type: "registerItem", eventId, item }),
		unregisterItem: (eventId, item) =>
			run({ type: "unregisterItem", eventId, item }),
		isPending: (key) => pending.has(key),
		hasPending: pending.size > 0,
	};
}
