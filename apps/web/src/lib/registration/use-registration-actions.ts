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
import {
	events_item_register_success,
	events_item_unregister_success,
	events_join_waitlist_success,
	events_register_full,
	events_register_success,
	events_request_success,
	events_unregister_success,
	header_my_events,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	type Mutation,
	useMutation,
	useMutationState,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { showRegistrationErrorToast } from "~/lib/event-registration/errors";

export type AgendaItemTarget = { id: string; title: string };

type RegistrationAction =
	| { type: "register"; eventId: string; answers?: Record<string, string> }
	| { type: "unregister"; eventId: string }
	| { type: "registerItem"; eventId: string; item: AgendaItemTarget }
	| { type: "unregisterItem"; eventId: string; item: AgendaItemTarget };

export type RegistrationActions = {
	/** `answers`: to the event's questions, by question id (events with questions). */
	register: (eventId: string, answers?: Record<string, string>) => void;
	unregister: (eventId: string) => void;
	registerItem: (eventId: string, item: AgendaItemTarget) => void;
	unregisterItem: (eventId: string, item: AgendaItemTarget) => void;
	/** Whether this action is in flight: `id` is the event id, or the agenda item id for item actions. */
	isPending: (type: RegistrationAction["type"], id: string) => boolean;
	/** Whether any action is in flight. */
	hasPending: boolean;
};

/** Shared by every screen, so all of them see the same actions in flight. */
const REGISTRATION_MUTATION_KEY = ["registration-action"];

function actionKey(type: RegistrationAction["type"], id: string): string {
	return `${type}:${id}`;
}

function keyOf(action: RegistrationAction): string {
	return actionKey(
		action.type,
		"item" in action ? action.item.id : action.eventId,
	);
}

function pendingKeyOf(mutation: Mutation<unknown, Error, unknown>): string {
	return keyOf(mutation.state.variables as RegistrationAction);
}

/** `invite`: the invite-link secret of the page the action comes from, if any. */
function runAction(action: RegistrationAction, invite: string | undefined) {
	switch (action.type) {
		case "register":
			return registerForEventServer({
				data: {
					eventId: action.eventId,
					locale: getLocale(),
					invite,
					answers: action.answers,
				},
			});
		case "unregister":
			return unregisterFromEventServer({ data: { eventId: action.eventId } });
		case "registerItem":
			return registerForAgendaItemServer({
				data: { agendaItemId: action.item.id, locale: getLocale(), invite },
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
			if (!result || !("state" in result)) return events_register_success();
			if (result.state === "pending") return events_request_success();
			return result.state === "waitlisted"
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

/**
 * The one registration flow for every screen: call the server, then refetch
 * the user's registrations, the event page and the lists it changed.
 */
export function useRegistrationActions(): RegistrationActions {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const invite = useSearch({
		strict: false,
		select: (search) => search.invite,
	});

	const refreshKeys = (eventId: string) => [
		// A prefix: also the account list and open tickets.
		myRegistrationsQueryOptions.queryKey,
		eventDetailsQueryOptions(eventId).queryKey,
		eventsQueryKeyPrefix,
	];

	/** Runs one action end to end; errors are shown here, so the mutation itself never fails. */
	const execute = async (action: RegistrationAction) => {
		try {
			const result = await runAction(action, invite);
			toast.success(successMessage(action, result), {
				// Where the registration now lives, one tap away.
				action: {
					label: header_my_events(),
					onClick: () => void navigate({ to: "/my-events" }),
				},
			});
		} catch (error) {
			showRegistrationErrorToast(error, events_register_full);
		} finally {
			await Promise.all(
				refreshKeys(action.eventId).map((queryKey) =>
					queryClient.invalidateQueries({ queryKey }),
				),
			);
		}
	};

	// Mutations without a scope run side by side, so actions on different events don't wait for each other.
	const { mutate } = useMutation({
		mutationKey: REGISTRATION_MUTATION_KEY,
		mutationFn: execute,
	});
	const pending = new Set(
		useMutationState({
			filters: { mutationKey: REGISTRATION_MUTATION_KEY, status: "pending" },
			select: pendingKeyOf,
		}),
	);

	const run = (action: RegistrationAction) => {
		// Read the cache, not render state: a second click before the re-render is still ignored.
		const key = keyOf(action);
		// isMutating counts only pending mutations.
		const inFlight = queryClient.isMutating({
			mutationKey: REGISTRATION_MUTATION_KEY,
			predicate: (mutation) => pendingKeyOf(mutation) === key,
		});
		if (inFlight === 0) {
			mutate(action);
		}
	};

	return {
		register: (eventId, answers) => run({ type: "register", eventId, answers }),
		unregister: (eventId) => run({ type: "unregister", eventId }),
		registerItem: (eventId, item) =>
			run({ type: "registerItem", eventId, item }),
		unregisterItem: (eventId, item) =>
			run({ type: "unregisterItem", eventId, item }),
		isPending: (type, id) => pending.has(actionKey(type, id)),
		hasPending: pending.size > 0,
	};
}
