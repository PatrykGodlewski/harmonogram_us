import { invitationQueryOptions } from "@repo/api/groups/queries";
import {
	error_invitation_invalid,
	events_register_full,
	invite_confirm,
	invite_deadline,
	invite_description,
	invite_email,
	invite_group,
	invite_items,
	invite_switch_user,
	invite_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale, localizeHref } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import { formatWarsawDate, formatWarsawTime } from "@repo/ui/time";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { groupErrorMessage } from "~/lib/groups/errors";

/**
 * Confirm page for an emailed invitation. Opening it changes nothing (email
 * link scanners are safe); only the button confirms and signs the person in.
 */
export const Route = createFileRoute("/invite/$token")({
	loader: ({ context: { queryClient }, params }) =>
		queryClient
			.ensureQueryData(invitationQueryOptions(params.token))
			.catch(() => null),
	component: InvitePage,
});

type AcceptResponse = { eventId: string; redirectTo: string };

function InvitePage() {
	const { token } = Route.useParams();
	const { user } = Route.useRouteContext();
	const locale = getLocale();
	const invitation = useQuery({
		...invitationQueryOptions(token),
		retry: false,
	});

	const accept = useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.$fetch<AcceptResponse>(
				"/group-invitation/accept",
				{
					method: "POST",
					body: { token },
				},
			);
			if (error) {
				throw error;
			}
			return data;
		},
		onSuccess: (data) => {
			// Full reload so the new session cookie is used everywhere.
			window.location.assign(localizeHref(data?.redirectTo ?? "/"));
		},
	});

	const shell = (children: React.ReactNode) => (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
			{children}
		</div>
	);

	if (invitation.isError) {
		return shell(
			<p className="text-muted-foreground">{error_invitation_invalid()}</p>,
		);
	}
	const view = invitation.data;
	if (!view) {
		return null;
	}
	const when = (date: Date | string) =>
		`${formatWarsawDate(date, locale)}, ${formatWarsawTime(date, locale)}`;

	return shell(
		<>
			<h1 className="text-2xl font-semibold">{invite_title()}</h1>
			<p>
				{invite_description({
					teacher: view.group.ownerName ?? "",
					event: view.group.eventTitle,
					date: when(view.group.eventDate),
				})}
			</p>
			{view.group.name ? (
				<p>{invite_group({ group: view.group.name })}</p>
			) : null}
			{view.itemTitles.length > 0 ? (
				<p>{invite_items({ items: view.itemTitles.join(", ") })}</p>
			) : null}
			<>
				<p className="text-sm text-muted-foreground">
					{user && user.email !== view.email
						? invite_switch_user({ current: user.email, email: view.email })
						: invite_email({ email: view.email })}
				</p>
				<p className="text-sm text-muted-foreground">
					{invite_deadline({ deadline: when(view.group.deadline) })}
				</p>
				{accept.isError ? (
					<p className="text-sm text-destructive" role="alert">
						{groupErrorMessage(accept.error, events_register_full)}
					</p>
				) : null}
				<Button
					size="lg"
					disabled={accept.isPending}
					onClick={() => accept.mutate()}
				>
					{invite_confirm()}
				</Button>
			</>
		</>,
	);
}
