import {
	events_register,
	events_register_login_required,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Link, useSearch } from "@tanstack/react-router";

/**
 * Signed out: the one way to register. The sign-in page offers an account or an
 * e-mail link for this event (F17) and brings the person back here.
 */
export function LoginToRegisterButton({ eventId }: { eventId: string }) {
	const { invite } = useSearch({ strict: false }) as { invite?: string };
	return (
		<Button
			size="sm"
			className="w-full sm:w-auto"
			asChild
			title={events_register_login_required()}
		>
			<Link
				to="/login"
				search={{
					// Back to the event with its invite: an invite-only page needs it to open.
					redirect: invite
						? `/events/${eventId}?invite=${encodeURIComponent(invite)}`
						: `/events/${eventId}`,
					event: eventId,
					invite,
				}}
			>
				{events_register()}
			</Link>
		</Button>
	);
}
