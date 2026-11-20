import { addRegistrantServer } from "@repo/api/admin/registrants";
import {
	admin_action_cancel,
	admin_error_generic,
	admin_registrants_add,
	admin_registrants_add_body,
	admin_registrants_add_submit,
	admin_registrants_add_title,
	admin_registrants_added,
	csv_header_email,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type AddRegistrantDialogProps = {
	eventId: string;
	onAdded: () => Promise<unknown>;
};

/** Registers an existing account by e-mail (waitlist when the event is full). */
export function AddRegistrantDialog({
	eventId,
	onAdded,
}: AddRegistrantDialogProps) {
	const inputId = useId();
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");

	const addMutation = useMutation({
		mutationFn: (value: string) =>
			addRegistrantServer({
				data: { eventId, email: value, locale: getLocale() },
			}),
		onSuccess: async () => {
			toast.success(admin_registrants_added());
			setEmail("");
			setOpen(false);
			await onAdded();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (email.trim()) {
			addMutation.mutate(email.trim());
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm" variant="outline">
					{admin_registrants_add()}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{admin_registrants_add_title()}</DialogTitle>
					<DialogDescription>{admin_registrants_add_body()}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor={inputId}>{csv_header_email()}</Label>
						<Input
							id={inputId}
							type="email"
							required
							autoComplete="off"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							{admin_action_cancel()}
						</Button>
						<Button type="submit" disabled={addMutation.isPending}>
							{admin_registrants_add_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
