import { regenerateInviteServer } from "@repo/api/admin/mutations";
import { siteUrlQueryOptions } from "@repo/api/site";
import {
	admin_action_cancel,
	admin_error_generic,
	admin_invite_copied,
	admin_invite_copy,
	admin_invite_link,
	admin_invite_regenerate,
	admin_invite_regenerate_body,
	admin_invite_regenerate_title,
	admin_invite_regenerated,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
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
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type InviteLinkCardProps = {
	eventId: string;
	inviteToken: string;
	onChanged: () => Promise<unknown>;
};

/** The invite link of an invite-only event: copy it, or replace it to revoke the old one. */
export function InviteLinkCard({
	eventId,
	inviteToken,
	onChanged,
}: InviteLinkCardProps) {
	const fieldId = useId();
	const { data: siteUrl } = useQuery(siteUrlQueryOptions);
	const link = siteUrl
		? `${siteUrl}/${getLocale()}/events/${eventId}?invite=${inviteToken}`
		: "";
	const regenerateMutation = useMutation({
		mutationFn: () => regenerateInviteServer({ data: { id: eventId } }),
		onSuccess: async () => {
			toast.success(admin_invite_regenerated());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});
	const handleCopy = async () => {
		await navigator.clipboard.writeText(link);
		toast.success(admin_invite_copied());
	};

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3">
			<Label htmlFor={fieldId}>{admin_invite_link()}</Label>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					id={fieldId}
					readOnly
					value={link}
					onFocus={(event) => event.currentTarget.select()}
				/>
				<div className="flex gap-2">
					<Button
						variant="outline"
						disabled={!link}
						onClick={handleCopy}
						className="flex-1 sm:flex-none"
					>
						{admin_invite_copy()}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="outline"
								disabled={regenerateMutation.isPending}
								className="flex-1 sm:flex-none"
							>
								{admin_invite_regenerate()}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{admin_invite_regenerate_title()}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{admin_invite_regenerate_body()}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{admin_action_cancel()}</AlertDialogCancel>
								<AlertDialogAction onClick={() => regenerateMutation.mutate()}>
									{admin_invite_regenerate()}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</div>
	);
}
