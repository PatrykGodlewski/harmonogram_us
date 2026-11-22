import { MAX_INVITATIONS } from "@repo/api/admin/invitation-limits";
import { sendEventInvitationsServer } from "@repo/api/admin/invitations";
import { parseEmailList } from "@repo/api/groups/parse-email-list";
import {
	admin_action_cancel,
	admin_error_generic,
	admin_invite_count,
	admin_invite_description,
	admin_invite_emails,
	admin_invite_emails_hint,
	admin_invite_invalid,
	admin_invite_note,
	admin_invite_open,
	admin_invite_send,
	admin_invite_sent,
	admin_invite_title,
	admin_invite_too_many,
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
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

/** Invites people by e-mail to a published event (the link opens invite-only events too). */
export function InviteDialog({ eventId }: { eventId: string }) {
	const emailsId = useId();
	const hintId = useId();
	const noteId = useId();
	const [open, setOpen] = useState(false);
	const [emails, setEmails] = useState("");
	const [note, setNote] = useState("");
	const parsed = parseEmailList(emails);
	const tooMany = parsed.valid.length > MAX_INVITATIONS;
	const canSend =
		parsed.valid.length > 0 && parsed.invalid.length === 0 && !tooMany;

	const sendMutation = useMutation({
		mutationFn: () =>
			sendEventInvitationsServer({
				data: {
					eventId,
					emails: parsed.valid,
					note: note.trim() || undefined,
					locale: getLocale(),
				},
			}),
		onSuccess: ({ sent }) => {
			toast.success(admin_invite_sent({ count: sent }));
			setEmails("");
			setNote("");
			setOpen(false);
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (canSend) {
			sendMutation.mutate();
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline">{admin_invite_open()}</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{admin_invite_title()}</DialogTitle>
					<DialogDescription>{admin_invite_description()}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor={emailsId}>{admin_invite_emails()}</Label>
						<Textarea
							id={emailsId}
							rows={5}
							inputMode="email"
							autoComplete="off"
							aria-describedby={hintId}
							aria-invalid={parsed.invalid.length > 0 || tooMany}
							value={emails}
							onChange={(event) => setEmails(event.target.value)}
						/>
						<p id={hintId} className="text-xs text-muted-foreground">
							{parsed.invalid.length > 0 ? (
								<span className="text-destructive">
									{admin_invite_invalid({ list: parsed.invalid.join(", ") })}
								</span>
							) : tooMany ? (
								<span className="text-destructive">
									{admin_invite_too_many({ max: MAX_INVITATIONS })}
								</span>
							) : parsed.valid.length > 0 ? (
								admin_invite_count({ count: parsed.valid.length })
							) : (
								admin_invite_emails_hint({ max: MAX_INVITATIONS })
							)}
						</p>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor={noteId}>{admin_invite_note()}</Label>
						<Textarea
							id={noteId}
							rows={4}
							maxLength={2000}
							value={note}
							onChange={(event) => setNote(event.target.value)}
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
						<Button type="submit" disabled={!canSend || sendMutation.isPending}>
							{admin_invite_send()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
