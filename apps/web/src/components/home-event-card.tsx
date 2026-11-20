import { events_seats_remaining } from "@repo/i18n/paraglide/messages";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { Link } from "@tanstack/react-router";
import { EventRegistrationButton } from "~/components/event-registration-button";
import { formatEventDateForLocale } from "~/lib/events/format-event-date";
import type {
	EventSeatCountSource,
	HomeEventListEvent,
} from "~/lib/events/types";
import type { EventRegistrationActions } from "~/lib/registration/use-event-list-registrations";
import { AttendanceModeBadge } from "./attendance-mode-badge";

type HomeEventCardProps = {
	event: HomeEventListEvent;
	user: { id: string; email: string } | null;
	interactive: boolean;
	seatCounts: EventSeatCountSource;
	registrations: EventRegistrationActions;
};

export function HomeEventCard({
	event,
	user,
	interactive,
	seatCounts,
	registrations,
}: HomeEventCardProps) {
	const fallback = {
		seatsRemaining: event.seatsRemaining,
		maxSeats: event.maxSeats,
	};
	const { seatsRemaining, maxSeats } = seatCounts.getDisplaySeatCount(
		event.id,
		fallback,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Link
						to="/events/$eventId"
						params={{ eventId: event.id }}
						className="hover:underline"
					>
						{event.title}
					</Link>
				</CardTitle>
				<CardDescription>
					{formatEventDateForLocale(event.date)}
					{" · "}
					{events_seats_remaining({ remaining: seatsRemaining, max: maxSeats })}
				</CardDescription>
				<CardAction>
					<EventRegistrationButton
						eventId={event.id}
						user={user}
						interactive={interactive}
						seatsRemaining={seatsRemaining}
						registrations={registrations}
					/>
				</CardAction>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					<AttendanceModeBadge mode={event.attendanceMode} />
					<Badge variant="secondary">{event.typeLabel}</Badge>
					{event.locationLabel ? (
						<Badge variant="outline">{event.locationLabel}</Badge>
					) : null}
					{event.facultyLabel ? (
						<Badge variant="outline">{event.facultyLabel}</Badge>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

type HomeEventCardsProps = {
	events: HomeEventListEvent[];
	user: { id: string; email: string } | null;
	refetching: boolean;
	interactive: boolean;
	seatCounts: EventSeatCountSource;
	registrations: EventRegistrationActions;
};

export function HomeEventCards({
	events,
	user,
	refetching,
	interactive,
	seatCounts,
	registrations,
}: HomeEventCardsProps) {
	return (
		<div
			className="flex flex-col gap-4 transition-opacity data-[busy=true]:opacity-60"
			data-busy={refetching || undefined}
			aria-busy={refetching}
		>
			{events.map((event) => (
				<HomeEventCard
					key={event.id}
					event={event}
					user={user}
					interactive={interactive}
					seatCounts={seatCounts}
					registrations={registrations}
				/>
			))}
		</div>
	);
}
