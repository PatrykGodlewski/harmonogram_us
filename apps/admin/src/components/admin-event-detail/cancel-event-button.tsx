import { cancelAdminEventServer } from "@repo/api/admin/mutations";
import {
	admin_error_generic,
	admin_event_cancel,
	admin_event_cancel_body,
	admin_event_cancel_keep,
	admin_event_cancel_title,
	admin_event_cancelled_toast,
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

type CancelEventButtonProps = {
	eventId: string;
	onCancelled: () => Promise<unknown>;
};

/** Cancels a published event after a confirmation; registrants are e-mailed. */
export function CancelEventButton({
	eventId,
	onCancelled,
}: CancelEventButtonProps) {
	const cancelMutation = useMutation({
		mutationFn: () => cancelAdminEventServer({ data: { id: eventId } }),
		onSuccess: async () => {
			toast.success(admin_event_cancelled_toast());
			await onCancelled();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive" disabled={cancelMutation.isPending}>
					{admin_event_cancel()}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{admin_event_cancel_title()}</AlertDialogTitle>
					<AlertDialogDescription>
						{admin_event_cancel_body()}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{admin_event_cancel_keep()}</AlertDialogCancel>
					<AlertDialogAction onClick={() => cancelMutation.mutate()}>
						{admin_event_cancel()}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
