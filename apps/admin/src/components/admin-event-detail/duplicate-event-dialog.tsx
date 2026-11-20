import { duplicateAdminEventServer } from "@repo/api/admin/mutations";
import {
	admin_action_cancel,
	admin_error_generic,
	admin_event_duplicate,
	admin_event_duplicate_body,
	admin_event_duplicate_date,
	admin_event_duplicate_title,
	admin_event_duplicated,
} from "@repo/i18n/paraglide/messages";
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
import { fromEventWallTime } from "@repo/ui/time";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

/** Copies the event to a new date (as a draft) and opens the copy. */
export function DuplicateEventDialog({ eventId }: { eventId: string }) {
	const inputId = useId();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [dateTime, setDateTime] = useState("");

	const duplicateMutation = useMutation({
		mutationFn: (date: Date) =>
			duplicateAdminEventServer({ data: { id: eventId, date } }),
		onSuccess: async ({ id }) => {
			toast.success(admin_event_duplicated());
			setOpen(false);
			await navigate({ to: "/events/$eventId", params: { eventId: id } });
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const [date = "", time = ""] = dateTime.split("T");
		if (date && time) {
			duplicateMutation.mutate(fromEventWallTime(date, time));
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">{admin_event_duplicate()}</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{admin_event_duplicate_title()}</DialogTitle>
					<DialogDescription>{admin_event_duplicate_body()}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor={inputId}>{admin_event_duplicate_date()}</Label>
						<Input
							id={inputId}
							type="datetime-local"
							required
							value={dateTime}
							onChange={(event) => setDateTime(event.target.value)}
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
						<Button type="submit" disabled={duplicateMutation.isPending}>
							{admin_event_duplicate()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
