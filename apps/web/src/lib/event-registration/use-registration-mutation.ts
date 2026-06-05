import type { EventFiltersParams } from "@repo/api/events/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { syncSeatCountAfterLocalChange } from "~/lib/events/seat-count";
import type { useEventSeatCounts } from "~/lib/events/use-event-seat-counts";
import { publishRegistrationChange } from "./cross-tab";
import { showRegistrationErrorToast } from "./errors";
import {
	invalidateRegisteredEventIds,
	readRegisteredEventIds,
	restoreRegisteredEventIds,
	snapshotRegisteredEventIds,
} from "./registered-events-cache";
import type {
	RegisteredEventsMutationContext,
	RegistrationMutationResult,
} from "./types";

type SeatCounts = Pick<
	ReturnType<typeof useEventSeatCounts>,
	"adjust" | "clear"
>;

export type RegistrationMutationConfig = {
	mutationFn: (eventId: string) => Promise<RegistrationMutationResult>;
	seatDelta: number;
	registered: boolean;
	successToast: () => string;
	fallbackErrorMessage: () => string;
	assertCanMutate: (registeredIds: string[], eventId: string) => void;
	applyOptimisticRegistration: (eventId: string) => void;
};

export function useRegistrationMutation(
	config: RegistrationMutationConfig,
	filters: EventFiltersParams,
	seatCounts: SeatCounts,
) {
	const queryClient = useQueryClient();
	const { adjust, clear } = seatCounts;

	return useMutation({
		mutationFn: config.mutationFn,
		onMutate: async (eventId) => {
			config.assertCanMutate(readRegisteredEventIds(queryClient), eventId);
			adjust(eventId, config.seatDelta);

			const previousRegisteredIds =
				await snapshotRegisteredEventIds(queryClient);
			config.applyOptimisticRegistration(eventId);

			return {
				previousRegisteredIds,
			} satisfies RegisteredEventsMutationContext;
		},
		onSuccess: (result, eventId) => {
			toast.success(config.successToast());
			publishRegistrationChange({
				eventId,
				seatDelta: config.seatDelta,
				txid: result?.txid,
				registered: config.registered,
			});
			void syncSeatCountAfterLocalChange(queryClient, filters, result).finally(
				() => {
					clear(eventId);
				},
			);
		},
		onError: (error, eventId, context) => {
			clear(eventId);
			restoreRegisteredEventIds(queryClient, context?.previousRegisteredIds);
			showRegistrationErrorToast(error, config.fallbackErrorMessage);
		},
		onSettled: () => {
			void invalidateRegisteredEventIds(queryClient);
		},
	});
}
