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
import { appErrorMessage } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import { formatEventDateTime } from "@repo/ui/time";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LandingShell } from "~/components/groups/landing-shell";
import { authClient } from "~/lib/auth-client";

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

	const shell = (children: ReactNode) => (
		<LandingShell>{children}</LandingShell>
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
	return shell(
		<>
			<h1 className="text-2xl font-semibold">{invite_title()}</h1>
			<p>
				{invite_description({
					teacher: view.group.ownerName ?? "",
					event: view.group.eventTitle,
					date: formatEventDateTime(view.group.eventDate, locale),
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
					{invite_deadline({
						deadline: formatEventDateTime(view.group.deadline, locale),
					})}
				</p>
				{accept.isError ? (
					<p className="text-sm text-destructive" role="alert">
						{appErrorMessage(accept.error, events_register_full)}
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
