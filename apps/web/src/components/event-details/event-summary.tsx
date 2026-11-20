import {
	calendar_add,
	event_cancelled_banner,
	event_details_closed,
	event_details_places_left,
	event_details_requires_approval,
	event_join_online,
	event_room,
	events_join_waitlist,
	events_leave_waitlist,
	events_pending_approval,
	events_register,
	events_registered,
	events_rejected,
	events_request_registration,
	events_unregister,
	events_waitlisted,
	events_withdraw_request,
	groups_register_group,
	privacy_link,
	privacy_notice_short,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { AttendanceModeBadge } from "@repo/ui/composed/events/attendance-mode-badge";
import { formatEventDateTime } from "@repo/ui/time";
import { Link, useSearch } from "@tanstack/react-router";
import type {
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import type { EventSeatCount } from "~/lib/events/types";
import { LoginToRegisterButton } from "./login-to-register-button";
import { UnregisterEventDialog } from "./unregister-event-dialog";

type EventSummaryProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	isClosed: boolean;
	isCancelled: boolean;
	seatCount: EventSeatCount;
	registrations: EventDetailsRegistrations;
};

export function EventSummary({
	event,
	user,
	interactive,
	isClosed,
	isCancelled,
	seatCount,
	registrations,
}: EventSummaryProps) {
	const locale = getLocale();
	const invite = useSearch({
		strict: false,
		select: (search) => search.invite,
	});

	return (
		<section className="flex flex-col gap-4">
			{isCancelled ? (
				<div
					role="status"
					className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 font-medium text-destructive"
				>
					{event_cancelled_banner()}
				</div>
			) : null}
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
				<p className="text-muted-foreground">
					{formatEventDateTime(event.date, locale)}
				</p>
				<div className="flex flex-wrap gap-2">
					<AttendanceModeBadge mode={event.attendanceMode} />
					<Badge variant="secondary">{event.typeLabel}</Badge>
					{event.facultyLabel ? (
						<Badge variant="outline">{event.facultyLabel}</Badge>
					) : null}
					{event.locationLabel ? (
						<Badge variant="outline">{event.locationLabel}</Badge>
					) : null}
					{event.room ? (
						<Badge variant="outline">{event_room({ room: event.room })}</Badge>
					) : null}
				</div>
			</div>

			{event.description ? (
				<p className="max-w-prose whitespace-pre-line">{event.description}</p>
			) : null}

			<div className="flex flex-wrap gap-2">
				<Button asChild variant="outline" size="sm">
					<a
						href={`/api/calendar/event/${event.id}?${new URLSearchParams({
							lang: locale,
							...(invite ? { invite } : {}),
						})}`}
						download
					>
						{calendar_add()}
					</a>
				</Button>
			</div>

			{event.onlineUrl ? (
				<div>
					<Button asChild variant="outline">
						<a href={event.onlineUrl} target="_blank" rel="noopener noreferrer">
							{event_join_online()}
						</a>
					</Button>
				</div>
			) : null}

			<div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
				<p className="tabular-nums" aria-live="polite" aria-atomic="true">
					{event_details_places_left({
						remaining: seatCount.seatsRemaining,
						max: seatCount.maxSeats,
					})}
				</p>
				<EventRegistrationAction
					eventId={event.id}
					user={user}
					interactive={interactive}
					isClosed={isClosed}
					isFull={seatCount.seatsRemaining <= 0}
					requiresApproval={event.requiresApproval}
					registrations={registrations}
				/>
			</div>
			{event.requiresApproval && !isClosed ? (
				<p className="text-sm text-muted-foreground">
					{event_details_requires_approval()}
				</p>
			) : null}
			{isClosed ? null : (
				<p className="text-xs text-muted-foreground">
					{privacy_notice_short()}{" "}
					<Link to="/privacy" className="underline underline-offset-2">
						{privacy_link()}
					</Link>
				</p>
			)}
			{user &&
			!isCancelled &&
			!event.requiresApproval &&
			isBeforeGroupDeadline(event) ? (
				<Button variant="outline" size="sm" className="self-start" asChild>
					<Link to="/events/$eventId/groups/new" params={{ eventId: event.id }}>
						{groups_register_group()}
					</Link>
				</Button>
			) : null}
		</section>
	);
}

type EventRegistrationActionProps = {
	eventId: string;
	user: { id: string; email: string } | null;
	interactive: boolean;
	isClosed: boolean;
	isFull: boolean;
	requiresApproval: boolean;
	registrations: EventDetailsRegistrations;
};

function EventRegistrationAction({
	eventId,
	user,
	interactive,
	isClosed,
	isFull,
	requiresApproval,
	registrations,
}: EventRegistrationActionProps) {
	const busy = !interactive || registrations.isBusy;

	if (!user) {
		return isClosed ? (
			<p className="text-muted-foreground">{event_details_closed()}</p>
		) : (
			<LoginToRegisterButton eventId={eventId} />
		);
	}

	if (registrations.isEventRegistered && isClosed) {
		return (
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Badge>{events_registered()} ✓</Badge>
				<p className="text-sm text-muted-foreground">
					{event_details_closed()}
				</p>
			</div>
		);
	}

	if (registrations.isEventRegistered) {
		const unregisterButton = (
			<Button
				size="sm"
				variant="outline"
				className="w-full sm:w-auto"
				disabled={busy}
				onClick={
					registrations.registeredItemIds.size === 0
						? registrations.unregisterEvent
						: undefined
				}
			>
				{events_unregister()}
			</Button>
		);

		return (
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Badge>{events_registered()} ✓</Badge>
				{registrations.registeredItemIds.size > 0 ? (
					<UnregisterEventDialog onConfirm={registrations.unregisterEvent}>
						{unregisterButton}
					</UnregisterEventDialog>
				) : (
					unregisterButton
				)}
			</div>
		);
	}

	if (registrations.waitlistPosition !== null) {
		return (
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<p className="text-sm">
					{events_waitlisted({ position: registrations.waitlistPosition })}
				</p>
				<Button
					size="sm"
					variant="outline"
					className="w-full sm:w-auto"
					disabled={busy}
					onClick={registrations.unregisterEvent}
				>
					{events_leave_waitlist()}
				</Button>
			</div>
		);
	}

	if (registrations.approval === "rejected") {
		return <p className="text-sm text-muted-foreground">{events_rejected()}</p>;
	}

	if (registrations.approval === "pending") {
		return (
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Badge variant="secondary">{events_pending_approval()}</Badge>
				{isClosed ? null : (
					<Button
						size="sm"
						variant="outline"
						className="w-full sm:w-auto"
						disabled={busy}
						onClick={registrations.unregisterEvent}
					>
						{events_withdraw_request()}
					</Button>
				)}
			</div>
		);
	}

	if (isClosed) {
		return <p className="text-muted-foreground">{event_details_closed()}</p>;
	}

	return (
		<Button
			size="sm"
			variant={isFull ? "secondary" : "default"}
			className="w-full sm:w-auto"
			disabled={busy}
			onClick={registrations.registerEvent}
		>
			{requiresApproval
				? events_request_registration()
				: isFull
					? events_join_waitlist()
					: events_register()}
		</Button>
	);
}

function isBeforeGroupDeadline(event: EventDetailsData): boolean {
	const deadline =
		new Date(event.date).getTime() - event.groupDeadlineHours * 3_600_000;
	return deadline > Date.now();
}
