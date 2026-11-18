import { groups_cancel } from "@repo/i18n/paraglide/messages";
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

/** A button that asks for confirmation; the confirm action uses the same label. */
export function ConfirmButton({
	label,
	description,
	onConfirm,
	disabled,
	children,
}: {
	label: string;
	description: string;
	onConfirm: () => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild disabled={disabled}>
				{children}
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{label}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{groups_cancel()}</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>{label}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
