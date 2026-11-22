import { sendEventMessageServer } from "@repo/api/admin/event-message";
import {
	admin_action_cancel,
	admin_error_generic,
	admin_message_audience,
	admin_message_audience_all,
	admin_message_audience_registered,
	admin_message_audience_waitlisted,
	admin_message_body,
	admin_message_body_hint,
	admin_message_open,
	admin_message_selected,
	admin_message_send,
	admin_message_sent,
	admin_message_subject,
	admin_message_title,
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
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type Audience = "registered" | "waitlisted" | "all";

const AUDIENCE_LABELS: Record<Audience, () => string> = {
	registered: admin_message_audience_registered,
	waitlisted: admin_message_audience_waitlisted,
	all: admin_message_audience_all,
};

/** Writes one e-mail to the event's registrants (plain text). */
type MessageDialogProps = {
	eventId: string;
	/** Exactly these people (selected on the list) instead of choosing a group. */
	registrationIds?: string[];
	/** The button that opens the dialog (default: "Send a message"). */
	trigger?: ReactNode;
	onSent?: () => void;
};

export function MessageDialog({
	eventId,
	registrationIds,
	trigger,
	onSent,
}: MessageDialogProps) {
	const audienceId = useId();
	const subjectId = useId();
	const bodyId = useId();
	const [open, setOpen] = useState(false);
	const [audience, setAudience] = useState<Audience>("registered");
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");

	const sendMutation = useMutation({
		mutationFn: () =>
			sendEventMessageServer({
				data: { eventId, audience, subject, body, registrationIds },
			}),
		onSuccess: ({ recipients }) => {
			toast.success(admin_message_sent({ count: recipients }));
			setSubject("");
			setBody("");
			setOpen(false);
			onSent?.();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (subject.trim() && body.trim()) {
			sendMutation.mutate();
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? <Button variant="outline">{admin_message_open()}</Button>}
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{admin_message_title()}</DialogTitle>
					<DialogDescription>{admin_message_body_hint()}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					{registrationIds ? (
						<p className="text-sm font-medium">
							{admin_message_selected({ count: registrationIds.length })}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							<Label htmlFor={audienceId}>{admin_message_audience()}</Label>
							<Select
								value={audience}
								onValueChange={(value) => setAudience(value as Audience)}
							>
								<SelectTrigger id={audienceId} className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(AUDIENCE_LABELS) as Audience[]).map((key) => (
										<SelectItem key={key} value={key}>
											{AUDIENCE_LABELS[key]()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
					<div className="flex flex-col gap-2">
						<Label htmlFor={subjectId}>{admin_message_subject()}</Label>
						<Input
							id={subjectId}
							required
							maxLength={200}
							value={subject}
							onChange={(event) => setSubject(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor={bodyId}>{admin_message_body()}</Label>
						<Textarea
							id={bodyId}
							required
							rows={6}
							maxLength={5000}
							value={body}
							onChange={(event) => setBody(event.target.value)}
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
						<Button type="submit" disabled={sendMutation.isPending}>
							{admin_message_send()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
