import {
	admin_action_cancel,
	admin_action_save,
} from "@repo/i18n/paraglide/messages";
import type { ReactNode } from "react";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";

export interface AdminFormDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
	onSubmit: () => void;
	isSubmitting?: boolean;
}

export function AdminFormDialog({
	open,
	onOpenChange,
	title,
	children,
	onSubmit,
	isSubmitting = false,
}: AdminFormDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
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
							{admin_action_save()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
