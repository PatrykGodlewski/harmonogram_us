import {
	agenda_item_place,
	agenda_item_when,
	attendance_mode_online,
	calendar_add,
	event_cancelled_banner,
	event_details_closed,
	event_details_ended,
	event_details_places_left,
	event_details_requires_approval,
	event_details_seats,
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
import { Eyebrow } from "@repo/ui/composed/brand/eyebrow";
import { PixelHeading } from "@repo/ui/composed/brand/pixel-heading";
import { AttendanceModeBadge } from "@repo/ui/composed/events/attendance-mode-badge";
import { RegistrationAnswersDialog } from "@repo/ui/composed/registration-answers-dialog";
import { formatEventDateTime } from "@repo/ui/time";
import { Link, useSearch } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { EventCover } from "~/components/event-cover";
import { SeatsSentence } from "~/components/seats-sentence";
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
	const isRegistered = user !== null && registrations.isEventRegistered;

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
				<div className="flex items-center justify-between gap-3 border-b border-navy px-3 py-1.5">
					<Eyebrow className="truncate text-[11px]">{event.typeLabel}</Eyebrow>
					<AttendanceModeBadge mode={event.attendanceMode} />
				</div>
				<div className="flex flex-col items-start gap-3 p-5 sm:p-8">
					<PixelHeading
						level={1}
						className="text-[clamp(1.75rem,6vw,3rem)] leading-tight break-words"
						style={{ viewTransitionName: `event-title-${event.id}` }}
					>
						{event.title}
					</PixelHeading>
					{event.facultyLabel ? (
						<Badge variant="outline">{event.facultyLabel}</Badge>
					) : null}
				</div>
				<EventCover
					event={event}
					invite={invite}
					className="border-t border-navy"
				/>
				<dl className="grid border-t border-navy bg-white sm:grid-cols-3">
					<Fact term={agenda_item_when()}>
						{formatEventDateTime(event.date, locale)}
					</Fact>
					<Fact term={agenda_item_place()}>{placeText(event)}</Fact>
					<Fact term={event_details_seats()} live>
						{isClosed ? (
							isCancelled ? (
								event_details_closed()
							) : (
								event_details_ended()
							)
						) : (
							<SeatsSentence
								message={event_details_places_left}
								remaining={seatCount.seatsRemaining}
								max={seatCount.maxSeats}
							/>
						)}
					</Fact>
				</dl>
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

			{isClosed && !isRegistered ? null : (
				<div className="flex flex-col gap-3 border border-navy bg-cream p-4 shadow-[6px_6px_0_0_var(--navy)] sm:flex-row sm:items-center">
					<EventRegistrationAction
						eventId={event.id}
						user={user}
						interactive={interactive}
						isClosed={isClosed}
						isFull={seatCount.seatsRemaining <= 0}
						requiresApproval={event.requiresApproval}
						questions={event.questions}
						registrations={registrations}
					/>
				</div>
			)}
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

/** Location and room; "Online" for an event with no place and next to the place of a hybrid one. */
function placeText(event: EventDetailsData): string {
	const parts = [
		event.locationLabel,
		event.room ? event_room({ room: event.room }) : null,
	].filter((part): part is string => Boolean(part));
	if (event.attendanceMode === "hybrid" || parts.length === 0) {
		parts.push(attendance_mode_online());
	}
	return parts.join(", ");
}

type FactProps = {
	term: string;
	/** Announce changes to the value (the seat count). */
	live?: boolean;
	children: ReactNode;
};

/** One cell of the facts grid: the lines between cells are the cells' own top or left edge. */
function Fact({ term, live, children }: FactProps) {
	return (
		<div className="flex min-w-0 flex-col gap-1 border-t border-navy px-4 py-3 first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0">
			<dt className="font-mono text-xs font-bold tracking-widest uppercase">
				{term}
			</dt>
			<dd
				className="font-mono text-sm font-bold break-words tabular-nums"
				aria-live={live ? "polite" : undefined}
				aria-atomic={live ? "true" : undefined}
			>
				{children}
			</dd>
		</div>
	);
}

type EventRegistrationActionProps = {
	eventId: string;
	user: { id: string; email: string } | null;
	interactive: boolean;
	isClosed: boolean;
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
	isFull,
	requiresApproval,
	questions,
	registrations,
}: EventRegistrationActionProps) {
	const busy = !interactive || registrations.isBusy;
	const [answering, setAnswering] = useState(false);

	// Ended or cancelled: the seats cell words the state; only the record of a registration is
	// left here (the caller shows this box for a registered user only).
	if (isClosed) {
		return <Badge>{events_registered()} ✓</Badge>;
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
