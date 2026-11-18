import { events_register_full } from "@repo/i18n/paraglide/messages";
import { appErrorMessage } from "@repo/ui/app-errors";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

/** Mutation that refreshes the group afterwards and reports domain errors as toasts. */
export function useGroupAction<T>(
	refresh: () => Promise<unknown>,
	fn: (input: T) => Promise<unknown>,
	success?: () => string,
) {
	return useMutation({
		mutationFn: fn,
		onSuccess: async () => {
			await refresh();
			if (success) toast.success(success());
		},
		onError: (error) =>
			toast.error(appErrorMessage(error, events_register_full)),
	});
}
