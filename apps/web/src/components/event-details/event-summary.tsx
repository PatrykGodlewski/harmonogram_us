import {
	calendar_add,
	event_cancelled_banner,
	event_details_closed,
	event_details_ended,
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
import { RegistrationAnswersDialog } from "@repo/ui/composed/registration-answers-dialog";
import { formatEventDateTime } from "@repo/ui/time";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { EventCover } from "~/components/event-cover";
import type {
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import type { EventSeatCount } from "~/lib/events/types";
import { EditAnswersButton } from "./edit-answers-button";
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
					className="border border-navy bg-destructive p-4 font-mono font-bold text-white"
				>
					{event_cancelled_banner()}
				</div>
			) : null}
			<header className="border border-navy bg-green">
				<div className="flex items-center justify-between gap-3 border-b border-navy px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase">
					<span className="truncate">{event.typeLabel}</span>
					<AttendanceModeBadge mode={event.attendanceMode} />
				</div>
				<div className="flex flex-col gap-3 p-5 sm:p-8">
					<h1
						className="animate-pixel-reveal text-[clamp(1.75rem,6vw,3rem)] leading-tight break-words"
						style={{ viewTransitionName: `event-title-${event.id}` }}
					>
						{event.title}
					</h1>
					<p className="font-mono text-sm sm:text-base">
						{formatEventDateTime(event.date, locale)}
					</p>
				</div>
				<EventCover
					event={event}
					invite={invite}
					className="border-t border-navy"
				/>
				{event.facultyLabel || event.locationLabel || event.room ? (
					<div className="flex flex-wrap gap-2 border-t border-navy bg-manela px-5 py-3 sm:px-8">
						{event.locationLabel ? (
							<Badge variant="outline">{event.locationLabel}</Badge>
						) : null}
						{event.room ? (
							<Badge variant="outline">
								{event_room({ room: event.room })}
							</Badge>
						) : null}
						{event.facultyLabel ? (
							<Badge variant="outline">{event.facultyLabel}</Badge>
						) : null}
					</div>
				) : null}
			</header>

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

			<div className="flex flex-col gap-3 border border-navy bg-cream p-4 shadow-[6px_6px_0_0_var(--navy)] sm:flex-row sm:items-center sm:justify-between">
				{isClosed ? null : (
					<p
						className="font-mono font-bold tabular-nums"
						aria-live="polite"
						aria-atomic="true"
					>
						{event_details_places_left({
							remaining: seatCount.seatsRemaining,
							max: seatCount.maxSeats,
						})}
					</p>
				)}
				<EventRegistrationAction
					eventId={event.id}
					user={user}
					interactive={interactive}
					isClosed={isClosed}
					isCancelled={isCancelled}
					isFull={seatCount.seatsRemaining <= 0}
					requiresApproval={event.requiresApproval}
					questions={event.questions}
					registrations={registrations}
				/>
			</div>
			{user &&
			!isClosed &&
			event.questions.length > 0 &&
			(registrations.isEventRegistered ||
				registrations.waitlistPosition !== null ||
				registrations.approval === "pending") ? (
				<EditAnswersButton
					eventId={event.id}
					questions={event.questions}
					interactive={interactive}
				/>
			) : null}
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
					<Link
						to="/events/$eventId/groups/new"
						params={{ eventId: event.id }}
						search={{ invite }}
					>
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
	isCancelled: boolean;
	isFull: boolean;
	requiresApproval: boolean;
	questions: EventDetailsData["questions"];
	registrations: EventDetailsRegistrations;
};

function EventRegistrationAction({
	eventId,
	user,
	interactive,
	isClosed,
	isCancelled,
	isFull,
	requiresApproval,
	questions,
	registrations,
}: EventRegistrationActionProps) {
	const busy = !interactive || registrations.isBusy;
	const [answering, setAnswering] = useState(false);

	// Ended or cancelled: a record of what happened, nothing to click.
	if (isClosed) {
		const text = isCancelled ? event_details_closed() : event_details_ended();
		return user && registrations.isEventRegistered ? (
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Badge>{events_registered()} ✓</Badge>
				<p className="text-sm text-muted-foreground">{text}</p>
			</div>
		) : (
			<p className="text-muted-foreground">{text}</p>
		);
	}

	if (!user) {
		// One button: the sign-in page offers an account or an e-mail link (F17).
		return <LoginToRegisterButton eventId={eventId} />;
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
				<Button
					size="sm"
					variant="outline"
					className="w-full sm:w-auto"
					disabled={busy}
					onClick={registrations.unregisterEvent}
				>
					{events_withdraw_request()}
				</Button>
			</div>
		);
	}

	const label = requiresApproval
		? events_request_registration()
		: isFull
			? events_join_waitlist()
			: events_register();
	return (
		<>
			<Button
				size="sm"
				variant={isFull ? "secondary" : "default"}
				className="w-full sm:w-auto"
				disabled={busy}
				onClick={() =>
					questions.length > 0
						? setAnswering(true)
						: registrations.registerEvent()
				}
			>
				{label}
			</Button>
			{questions.length > 0 ? (
				<RegistrationAnswersDialog
					questions={questions}
					open={answering}
					onOpenChange={setAnswering}
					submitLabel={label}
					onSubmit={registrations.registerEvent}
				/>
			) : null}
		</>
	);
}

function isBeforeGroupDeadline(event: EventDetailsData): boolean {
	const deadline =
		new Date(event.date).getTime() - event.groupDeadlineHours * 3_600_000;
	return deadline > Date.now();
}
