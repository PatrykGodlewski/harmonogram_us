import {
	admin_action_cancel,
	admin_action_save,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import type { ReactNode } from "react";

export interface AdminFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	/** A line under the title explaining the form. */
	description?: string;
	/** The submit button's text (default „Zapisz”). */
	submitLabel?: string;
	children: ReactNode;
	onSubmit: () => void;
	isSubmitting?: boolean;
}

export function AdminFormDialog({
	open,
	onOpenChange,
	title,
	description,
	submitLabel,
	children,
	onSubmit,
	isSubmitting = false,
}: AdminFormDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description ? (
						<DialogDescription>{description}</DialogDescription>
					) : null}
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						onSubmit();
					}}
				>
					<div className="grid gap-4 py-2">{children}</div>
					<DialogFooter className="mt-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							{admin_action_cancel()}
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{submitLabel ?? admin_action_save()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
