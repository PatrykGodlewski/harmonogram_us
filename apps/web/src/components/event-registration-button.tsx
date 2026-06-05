import {
	events_register,
	events_register_full,
	events_register_login_required,
	events_registered,
	events_unregister,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { EventRegistrationActions } from "~/lib/event-registration/types";

type EventRegistrationButtonProps = {
	eventId: string;
	user: { id: string; email: string } | null;
	interactive: boolean;
	seatsRemaining: number;
	registrations: EventRegistrationActions;
};

export function EventRegistrationButton({
	eventId,
	user,
	interactive,
	seatsRemaining,
	registrations,
}: EventRegistrationButtonProps) {
	const isRegistered = registrations.isRegistered(eventId);
	const isRegisterPending = registrations.isRegisterPending(eventId);
	const isUnregisterPending = registrations.isUnregisterPending(eventId);
	const isMutating = isRegisterPending || isUnregisterPending;
	const isFull = seatsRemaining <= 0;

	if (!user) {
		return (
			<Button size="sm" asChild title={events_register_login_required()}>
				<Link to="/login" search={{ redirect: "/" }}>
					{events_register()}
				</Link>
			</Button>
		);
	}

	if (isRegistered) {
		return (
			<Button
				size="sm"
				variant="outline"
				disabled={!interactive || isMutating}
				onClick={() => registrations.unregister(eventId)}
			>
				{isUnregisterPending ? events_registered() : events_unregister()}
			</Button>
		);
	}

	if (isFull) {
		return (
			<Button size="sm" disabled aria-disabled title={events_register_full()}>
				{events_register()}
			</Button>
		);
	}

	return (
		<Button
			size="sm"
			disabled={!interactive || isRegisterPending}
			onClick={() => registrations.register(eventId)}
		>
			{events_register()}
		</Button>
	);
}
