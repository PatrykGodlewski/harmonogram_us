import {
	events_join_waitlist,
	events_leave_waitlist,
	events_register,
	events_register_login_required,
	events_registered,
	events_unregister,
	events_waitlisted,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Link } from "@tanstack/react-router";
import type { EventRegistrationActions } from "~/lib/registration/use-event-list-registrations";

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

	const position = registrations.waitlistPosition(eventId);
	if (position !== null) {
		return (
			<div className="flex flex-col items-end gap-1">
				<span className="text-sm text-muted-foreground">
					{events_waitlisted({ position })}
				</span>
				<Button
					size="sm"
					variant="outline"
					disabled={!interactive || isMutating}
					onClick={() => registrations.unregister(eventId)}
				>
					{events_leave_waitlist()}
				</Button>
			</div>
		);
	}

	return (
		<Button
			size="sm"
			variant={isFull ? "secondary" : "default"}
			disabled={!interactive || isRegisterPending}
			onClick={() => registrations.register(eventId)}
		>
			{isFull ? events_join_waitlist() : events_register()}
		</Button>
	);
}
