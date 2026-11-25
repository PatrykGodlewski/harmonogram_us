import {
	event_room,
	event_status_cancelled,
	events_seats_remaining,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { AttendanceModeBadge } from "@repo/ui/composed/events/attendance-mode-badge";
import { eventDateStamp } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { Link } from "@tanstack/react-router";
import { EventCover } from "~/components/event-cover";
import { EventRegistrationButton } from "~/components/event-registration-button";
import { formatEventDateForLocale } from "~/lib/events/format-event-date";
import type { HomeEventListEvent } from "~/lib/events/types";
import type { EventRegistrationActions } from "~/lib/registration/use-event-list-registrations";

type HomeEventCardProps = {
	event: HomeEventListEvent;
	user: { id: string; email: string } | null;
	interactive: boolean;
	registrations: EventRegistrationActions;
	/** Position in the list (picks the header strip colour). */
	index: number;
};

/** Header strip colours, in turn down the list. */
const STRIPS = ["bg-cream", "bg-purple", "bg-green"] as const;

export function HomeEventCard({
	event,
	user,
	interactive,
	registrations,
	index,
}: HomeEventCardProps) {
	const { seatsRemaining, maxSeats } = event;
	const isCancelled = event.status === "cancelled";
	const stamp = eventDateStamp(event.date, getLocale());

	return (
		<article
			data-slot="card"
			className="scroll-reveal flex flex-col border border-navy bg-white transition-[translate,box-shadow] duration-150 ease-out focus-within:-translate-x-1 focus-within:-translate-y-1 focus-within:shadow-[6px_6px_0_0_var(--navy)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--navy)]"
		>
			<div
				className={cn(
					"flex items-center justify-between gap-3 border-b border-navy px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase",
					isCancelled ? "bg-white" : STRIPS[index % STRIPS.length],
				)}
			>
				<span className="truncate">{event.typeLabel}</span>
				<AttendanceModeBadge mode={event.attendanceMode} />
			</div>
			<EventCover event={event} className="border-b border-navy" />
			<div className="grid flex-1 grid-cols-[4.5rem_1fr]">
				{/* A ticket stub: the day in pixels, the month under it. */}
				<p
					aria-hidden
					className="flex flex-col items-center justify-center gap-1 border-r border-dashed border-navy py-4"
				>
					<span className="font-pixel text-4xl leading-none tabular-nums">
						{stamp.day}
					</span>
					<span className="font-mono text-xs font-bold tracking-widest uppercase">
						{stamp.month}
					</span>
				</p>
				<div className="flex min-w-0 flex-col gap-3 p-4">
					<h3 className="text-lg leading-snug font-bold break-words">
						<Link
							to="/events/$eventId"
							params={{ eventId: event.id }}
							className="underline-offset-4 hover:underline"
							style={{ viewTransitionName: `event-title-${event.id}` }}
						>
							{event.title}
						</Link>
					</h3>
					<p className="font-mono text-sm tabular-nums">
						{formatEventDateForLocale(event.date)}
					</p>
					<div className="flex flex-wrap gap-2">
						{isCancelled ? (
							<Badge variant="destructive">{event_status_cancelled()}</Badge>
						) : null}
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
				</div>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy px-4 py-3">
				<p className="font-mono text-sm tabular-nums">
					{events_seats_remaining({ remaining: seatsRemaining, max: maxSeats })}
				</p>
				{isCancelled ? null : (
					<EventRegistrationButton
						eventId={event.id}
						user={user}
						interactive={interactive}
						seatsRemaining={seatsRemaining}
						requiresApproval={event.requiresApproval}
						hasQuestions={event.hasQuestions}
						registrations={registrations}
					/>
				)}
			</div>
		</article>
	);
}

type HomeEventCardsProps = {
	events: HomeEventListEvent[];
	user: { id: string; email: string } | null;
	refetching: boolean;
	interactive: boolean;
	registrations: EventRegistrationActions;
};

export function HomeEventCards({
	events,
	user,
	refetching,
	interactive,
	registrations,
}: HomeEventCardsProps) {
	return (
		<div
			className="grid gap-5 transition-opacity data-[busy=true]:opacity-60 md:grid-cols-2"
			data-busy={refetching || undefined}
			aria-busy={refetching}
		>
			{events.map((event, index) => (
				<HomeEventCard
					key={event.id}
					index={index}
					event={event}
					user={user}
					interactive={interactive}
					registrations={registrations}
				/>
			))}
		</div>
	);
}
