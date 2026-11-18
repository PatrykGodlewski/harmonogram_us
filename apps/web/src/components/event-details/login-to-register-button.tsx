import {
	events_register,
	events_register_login_required,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Link } from "@tanstack/react-router";

export function LoginToRegisterButton({ eventId }: { eventId: string }) {
	return (
		<Button
			size="sm"
			className="w-full sm:w-auto"
			asChild
			title={events_register_login_required()}
		>
			<Link to="/login" search={{ redirect: `/events/${eventId}` }}>
				{events_register()}
			</Link>
		</Button>
	);
}
