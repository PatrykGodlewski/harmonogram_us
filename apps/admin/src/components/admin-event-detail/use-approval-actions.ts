import {
	approveRegistrationsServer,
	rejectRegistrationsServer,
} from "@repo/api/admin/registrants";
import {
	admin_approval_done,
	admin_error_generic,
	admin_rejection_done,
} from "@repo/i18n/paraglide/messages";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

/** Approve or decline registration requests (one row or the selection). */
export function useApprovalActions(
	eventId: string,
	onDone: () => Promise<unknown>,
) {
	const handleError = (error: unknown) =>
		toast.error(formatMutationError(error, admin_error_generic));
	const approveMutation = useMutation({
		mutationFn: (registrationIds: string[]) =>
			approveRegistrationsServer({ data: { eventId, registrationIds } }),
		onSuccess: async ({ approved, waitlisted }) => {
			toast.success(admin_approval_done({ approved, waitlisted }));
			await onDone();
		},
		onError: handleError,
	});
	const rejectMutation = useMutation({
		mutationFn: (registrationIds: string[]) =>
			rejectRegistrationsServer({ data: { eventId, registrationIds } }),
		onSuccess: async ({ rejected }) => {
			toast.success(admin_rejection_done({ count: rejected }));
			await onDone();
		},
		onError: handleError,
	});
	return {
		approve: (registrationIds: string[], onSuccess?: () => void) =>
			approveMutation.mutate(registrationIds, { onSuccess }),
		reject: (registrationIds: string[], onSuccess?: () => void) =>
			rejectMutation.mutate(registrationIds, { onSuccess }),
		isBusy: approveMutation.isPending || rejectMutation.isPending,
	};
}
