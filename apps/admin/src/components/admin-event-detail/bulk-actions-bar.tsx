import {
	removeRegistrantsServer,
	setCheckedInManyServer,
} from "@repo/api/admin/registrants";
import {
	admin_action_cancel,
	admin_approve,
	admin_bulk_checkin,
	admin_bulk_clear,
	admin_bulk_count,
	admin_bulk_done,
	admin_bulk_message,
	admin_bulk_remove,
	admin_bulk_remove_confirm,
	admin_bulk_remove_title,
	admin_bulk_toolbar,
	admin_error_generic,
	admin_registrants_remove_body,
	admin_reject,
} from "@repo/i18n/paraglide/messages";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { MessageDialog } from "./message-dialog";
import type { useApprovalActions } from "./use-approval-actions";

type BulkActionsBarProps = {
	eventId: string;
	selectedIds: string[];
	onDone: () => Promise<unknown>;
	onClear: () => void;
	approval: ReturnType<typeof useApprovalActions>;
	/** Some selected people wait for approval (or were declined). */
	hasRequests: boolean;
};

/**
 * Actions on the people selected on the list. Pinned to the bottom of the
 * screen on phones, so it stays in reach while scrolling the list.
 */
export function BulkActionsBar({
	eventId,
	selectedIds,
	onDone,
	onClear,
	approval,
	hasRequests,
}: BulkActionsBarProps) {
	const handleError = (error: unknown) =>
		toast.error(formatMutationError(error, admin_error_generic));
	const finish = async (count: number) => {
		toast.success(admin_bulk_done({ count }));
		onClear();
		await onDone();
	};

	const checkInMutation = useMutation({
		mutationFn: () =>
			setCheckedInManyServer({
				data: { eventId, registrationIds: selectedIds, checkedIn: true },
			}),
		onSuccess: ({ updated }) => finish(updated),
		onError: handleError,
	});
	const removeMutation = useMutation({
		mutationFn: () =>
			removeRegistrantsServer({
				data: { eventId, registrationIds: selectedIds },
			}),
		onSuccess: ({ removed }) => finish(removed),
		onError: handleError,
	});
	const busy =
		checkInMutation.isPending || removeMutation.isPending || approval.isBusy;

	return (
		<div
			role="toolbar"
			aria-label={admin_bulk_toolbar()}
			className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-lg border bg-background p-3 shadow-lg"
		>
			<p className="mr-auto text-sm font-medium tabular-nums">
				{admin_bulk_count({ count: selectedIds.length })}
			</p>
			<Button
				size="sm"
				disabled={busy}
				onClick={() => checkInMutation.mutate()}
			>
				{admin_bulk_checkin()}
			</Button>
			{hasRequests ? (
				<>
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={() => approval.approve(selectedIds, onClear)}
					>
						{admin_approve()}
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={() => approval.reject(selectedIds, onClear)}
					>
						{admin_reject()}
					</Button>
				</>
			) : null}
			<MessageDialog
				eventId={eventId}
				registrationIds={selectedIds}
				onSent={onClear}
				trigger={
					<Button size="sm" variant="outline" disabled={busy}>
						{admin_bulk_message()}
					</Button>
				}
			/>
			<AlertDialog>
				<AlertDialogTrigger asChild>
					<Button size="sm" variant="outline" disabled={busy}>
						{admin_bulk_remove()}
					</Button>
				</AlertDialogTrigger>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{admin_bulk_remove_title()}</AlertDialogTitle>
						<AlertDialogDescription>
							{admin_registrants_remove_body()}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{admin_action_cancel()}</AlertDialogCancel>
						<AlertDialogAction onClick={() => removeMutation.mutate()}>
							{admin_bulk_remove_confirm({ count: selectedIds.length })}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
			<Button size="sm" variant="ghost" onClick={onClear}>
				{admin_bulk_clear()}
			</Button>
		</div>
	);
}
