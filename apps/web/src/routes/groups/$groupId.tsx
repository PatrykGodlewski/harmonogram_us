import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import {
	closeGroupServer,
	inviteToGroupServer,
	removeMemberServer,
	resendInvitationServer,
	setMemberItemsServer,
	updateGroupServer,
} from "@repo/api/groups/mutations";
import { parseEmailList } from "@repo/api/groups/parse-email-list";
import { groupDetailsQueryOptions } from "@repo/api/groups/queries";
import {
	events_register_full,
	groups_add_emails,
	groups_add_emails_submit,
	groups_cancel,
	groups_close,
	groups_close_confirm,
	groups_closed_success,
	groups_deadline,
	groups_field_places,
	groups_member_confirmed,
	groups_member_invited,
	groups_member_items,
	groups_member_remove,
	groups_member_remove_confirm,
	groups_member_resend,
	groups_member_resent,
	groups_member_via_link,
	groups_members,
	groups_members_empty,
	groups_not_found,
	groups_places_save,
	groups_saved,
	groups_status_closed,
	groups_summary,
	groups_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
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
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { formatWarsawDate, formatWarsawTime } from "@repo/ui/time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { EmailListField } from "~/components/groups/email-list-field";
import { JoinLinkCard } from "~/components/groups/join-link-card";
import { MemberItemsSheet } from "~/components/groups/member-items-sheet";
import { groupErrorMessage } from "~/lib/groups/errors";

export const Route = createFileRoute("/groups/$groupId")({
	beforeLoad: ({ context, location }) => {
		requireAuthenticatedUser(context, { loginRedirect: location.href });
	},
	component: GroupPage,
});

function ConfirmButton({
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

/** Mutation that refreshes the group afterwards and reports domain errors as toasts. */
function useGroupAction<T>(
	refresh: () => Promise<unknown>,
	fn: (input: T) => Promise<unknown>,
	success?: () => string,
) {
	return useMutation({
		mutationFn: fn,
		onSuccess: async () => {
			await refresh();
			if (success) toast.success(success());
		},
		onError: (error) =>
			toast.error(groupErrorMessage(error, events_register_full)),
	});
}

function GroupPage() {
	const { groupId } = Route.useParams();
	const queryClient = useQueryClient();
	const locale = getLocale();
	const groupQuery = useQuery(groupDetailsQueryOptions(groupId));
	const group = groupQuery.data;
	const eventQuery = useQuery({
		...eventDetailsQueryOptions(group?.eventId ?? ""),
		enabled: Boolean(group?.eventId),
	});
	const [emails, setEmails] = useState("");
	const [places, setPlaces] = useState<number | null>(null);
	const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["group", groupId] }),
			queryClient.invalidateQueries({ queryKey: ["my-groups"] }),
		]);

	const invite = useGroupAction(
		refresh,
		(list: string[]) =>
			inviteToGroupServer({ data: { groupId, emails: list } }),
		groups_saved,
	);
	const resend = useGroupAction(
		refresh,
		(memberId: string) => resendInvitationServer({ data: { memberId } }),
		groups_member_resent,
	);
	const remove = useGroupAction(refresh, (memberId: string) =>
		removeMemberServer({ data: { memberId } }),
	);
	const setItems = useGroupAction(
		refresh,
		(input: { memberId: string; itemIds: string[] }) =>
			setMemberItemsServer({ data: input }),
		groups_saved,
	);
	const update = useGroupAction(
		refresh,
		(patch: {
			places?: number;
			joinLink?: "enable" | "disable" | "regenerate";
		}) => updateGroupServer({ data: { groupId, ...patch } }),
		groups_saved,
	);
	const close = useGroupAction(
		refresh,
		() => closeGroupServer({ data: { groupId } }),
		groups_closed_success,
	);

	if (groupQuery.isError) {
		return (
			<p className="mx-auto max-w-2xl p-4 text-muted-foreground sm:p-8">
				{groups_not_found()}
			</p>
		);
	}
	if (!group) {
		return null;
	}

	const open = group.status === "open";
	const busy =
		invite.isPending ||
		resend.isPending ||
		remove.isPending ||
		update.isPending ||
		close.isPending;
	const titles = new Map(
		(eventQuery.data?.agenda ?? []).map((item) => [item.id, item.title]),
	);
	const groupItems = group.itemIds.map((id) => ({
		id,
		title: titles.get(id) ?? id,
	}));
	const parsed = parseEmailList(emails);
	const free = group.places - group.confirmed - group.invited;
	const editingMember =
		group.members.find((member) => member.id === editingMemberId) ?? null;

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
			<div className="flex flex-col gap-1">
				<Link
					to="/events/$eventId"
					params={{ eventId: group.eventId }}
					className="text-sm text-muted-foreground hover:underline"
				>
					← {group.eventTitle}
				</Link>
				<h1 className="text-2xl font-semibold">
					{group.name ?? groups_title()}
				</h1>
				<p className="tabular-nums" aria-live="polite">
					{groups_summary({
						confirmed: group.confirmed,
						invited: group.invited,
						free: Math.max(0, free),
						places: group.places,
					})}
				</p>
				<p className="text-sm text-muted-foreground">
					{open
						? groups_deadline({
								deadline: `${formatWarsawDate(group.deadline, locale)}, ${formatWarsawTime(group.deadline, locale)}`,
							})
						: groups_status_closed()}
				</p>
			</div>

			{open ? (
				<JoinLinkCard
					joinCode={group.joinCode}
					disabled={busy}
					onChange={(joinLink) => update.mutate({ joinLink })}
				/>
			) : null}

			<section className="flex flex-col gap-3">
				<h2 className="font-semibold">{groups_members()}</h2>
				{group.members.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						{groups_members_empty()}
					</p>
				) : (
					<ul className="divide-y rounded-lg border">
						{group.members.map((member) => (
							<li key={member.id} className="flex flex-col gap-2 p-3">
								<div className="flex flex-wrap items-center gap-2">
									<span className="font-medium break-all">{member.email}</span>
									<Badge
										variant={
											member.status === "confirmed" ? "default" : "secondary"
										}
									>
										{member.status === "confirmed"
											? groups_member_confirmed()
											: groups_member_invited()}
									</Badge>
									{member.invitedVia === "link" ? (
										<span className="text-xs text-muted-foreground">
											{groups_member_via_link()}
										</span>
									) : null}
								</div>
								{member.itemIds.length > 0 ? (
									<div className="flex flex-wrap gap-1">
										{member.itemIds.map((id) => (
											<Badge key={id} variant="outline">
												{titles.get(id) ?? id}
											</Badge>
										))}
									</div>
								) : null}
								<div className="flex flex-wrap gap-2">
									{groupItems.length > 0 ? (
										<Button
											size="sm"
											variant="outline"
											disabled={busy}
											onClick={() => setEditingMemberId(member.id)}
										>
											{groups_member_items()}
										</Button>
									) : null}
									{member.status === "invited" && open ? (
										<Button
											size="sm"
											variant="outline"
											disabled={busy}
											onClick={() => resend.mutate(member.id)}
										>
											{groups_member_resend()}
										</Button>
									) : null}
									<ConfirmButton
										label={groups_member_remove()}
										description={groups_member_remove_confirm({
											email: member.email,
										})}
										onConfirm={() => remove.mutate(member.id)}
										disabled={busy}
									>
										<Button size="sm" variant="outline">
											{groups_member_remove()}
										</Button>
									</ConfirmButton>
								</div>
							</li>
						))}
					</ul>
				)}
			</section>

			{open ? (
				<>
					<section className="flex flex-col gap-3 rounded-lg border p-4">
						<EmailListField
							id="add-emails"
							label={groups_add_emails()}
							value={emails}
							onChange={setEmails}
							disabled={busy}
						/>
						<Button
							className="self-start"
							disabled={
								busy || parsed.valid.length === 0 || parsed.invalid.length > 0
							}
							onClick={() =>
								invite.mutate(parsed.valid, { onSuccess: () => setEmails("") })
							}
						>
							{groups_add_emails_submit()}
						</Button>
					</section>

					<section className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-end">
						<div className="flex flex-1 flex-col gap-1">
							<Label htmlFor="places">{groups_field_places()}</Label>
							<Input
								id="places"
								type="number"
								min={1}
								max={500}
								value={places ?? group.places}
								onChange={(event) => setPlaces(Number(event.target.value))}
							/>
						</div>
						<Button
							variant="outline"
							disabled={busy || places === null || places === group.places}
							onClick={() => places !== null && update.mutate({ places })}
						>
							{groups_places_save()}
						</Button>
					</section>

					<ConfirmButton
						label={groups_close()}
						description={groups_close_confirm()}
						onConfirm={() => close.mutate(undefined)}
						disabled={busy}
					>
						<Button variant="outline" className="self-start">
							{groups_close()}
						</Button>
					</ConfirmButton>
				</>
			) : null}

			<MemberItemsSheet
				member={editingMember}
				items={groupItems}
				saving={setItems.isPending}
				onClose={() => setEditingMemberId(null)}
				onSave={(memberId, itemIds) =>
					setItems.mutate(
						{ memberId, itemIds },
						{ onSuccess: () => setEditingMemberId(null) },
					)
				}
			/>
		</div>
	);
}
