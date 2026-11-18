import {
	event_details_cancel,
	event_details_unregister_body,
	event_details_unregister_confirm,
	event_details_unregister_title,
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
import type { ReactNode } from "react";

type UnregisterEventDialogProps = {
	children: ReactNode;
	onConfirm: () => void;
};

export function UnregisterEventDialog({
	children,
	onConfirm,
}: UnregisterEventDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{event_details_unregister_title()}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{event_details_unregister_body()}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{event_details_cancel()}</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>
						{event_details_unregister_confirm()}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
