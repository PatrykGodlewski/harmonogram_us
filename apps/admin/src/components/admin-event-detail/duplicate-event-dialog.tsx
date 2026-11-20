import { duplicateAdminEventServer } from "@repo/api/admin/mutations";
import {
	admin_action_cancel,
	admin_duplicate_copy,
	admin_duplicate_copy_agenda,
	admin_duplicate_copy_organizers,
	admin_duplicate_count,
	admin_duplicate_monthly,
	admin_duplicate_once,
	admin_duplicate_repeat,
	admin_duplicate_series_done,
	admin_duplicate_series_hint,
	admin_duplicate_series_submit,
	admin_duplicate_weekly,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { fromEventWallTime } from "@repo/ui/time";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type Repeat = "once" | "weekly" | "monthly";

const REPEAT_LABELS: Record<Repeat, () => string> = {
	once: admin_duplicate_once,
	weekly: admin_duplicate_weekly,
	monthly: admin_duplicate_monthly,
};

const MAX_COPIES = 12;

/** Copies the event to a new date, or as a weekly/monthly series (drafts), and opens the first copy. */
export function DuplicateEventDialog({ eventId }: { eventId: string }) {
	const dateId = useId();
	const repeatId = useId();
	const countId = useId();
	const agendaId = useId();
	const organizersId = useId();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [dateTime, setDateTime] = useState("");
	const [repeat, setRepeat] = useState<Repeat>("once");
	const [count, setCount] = useState(4);
	const [copyAgenda, setCopyAgenda] = useState(true);
	const [copyOrganizers, setCopyOrganizers] = useState(true);
	const copies = repeat === "once" ? 1 : count;

	const duplicateMutation = useMutation({
		mutationFn: (date: Date) =>
			duplicateAdminEventServer({
				data: {
					id: eventId,
					date,
					repeat,
					count: copies,
					copy: { agenda: copyAgenda, organizers: copyOrganizers },
				},
			}),
		onSuccess: async ({ id, ids }) => {
			toast.success(
				ids.length > 1
					? admin_duplicate_series_done({ count: ids.length })
					: admin_event_duplicated(),
			);
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
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{admin_event_duplicate_title()}</DialogTitle>
					<DialogDescription>{admin_event_duplicate_body()}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor={dateId}>{admin_event_duplicate_date()}</Label>
						<Input
							id={dateId}
							type="datetime-local"
							required
							value={dateTime}
							onChange={(event) => setDateTime(event.target.value)}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-2">
							<Label htmlFor={repeatId}>{admin_duplicate_repeat()}</Label>
							<Select
								value={repeat}
								onValueChange={(value) => setRepeat(value as Repeat)}
							>
								<SelectTrigger id={repeatId} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(REPEAT_LABELS) as Repeat[]).map((key) => (
										<SelectItem key={key} value={key}>
											{REPEAT_LABELS[key]()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						{repeat === "once" ? null : (
							<div className="flex flex-col gap-2">
								<Label htmlFor={countId}>{admin_duplicate_count()}</Label>
								<Input
									id={countId}
									type="number"
									inputMode="numeric"
									min={2}
									max={MAX_COPIES}
									required
									value={count}
									onChange={(event) =>
										setCount(
											Math.min(
												Math.max(Number(event.target.value) || 1, 1),
												MAX_COPIES,
											),
										)
									}
								/>
							</div>
						)}
					</div>
					{repeat === "once" ? null : (
						<p className="text-xs text-muted-foreground">
							{admin_duplicate_series_hint()}
						</p>
					)}
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-1 text-sm font-medium">
							{admin_duplicate_copy()}
						</legend>
						<div className="flex items-center gap-2">
							<input
								id={agendaId}
								type="checkbox"
								className="size-4 accent-primary"
								checked={copyAgenda}
								onChange={(event) => setCopyAgenda(event.target.checked)}
							/>
							<Label htmlFor={agendaId}>{admin_duplicate_copy_agenda()}</Label>
						</div>
						<div className="flex items-center gap-2">
							<input
								id={organizersId}
								type="checkbox"
								className="size-4 accent-primary"
								checked={copyOrganizers}
								onChange={(event) => setCopyOrganizers(event.target.checked)}
							/>
							<Label htmlFor={organizersId}>
								{admin_duplicate_copy_organizers()}
							</Label>
						</div>
					</fieldset>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							{admin_action_cancel()}
						</Button>
						<Button type="submit" disabled={duplicateMutation.isPending}>
							{copies > 1
								? admin_duplicate_series_submit({ count: copies })
								: admin_event_duplicate()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
