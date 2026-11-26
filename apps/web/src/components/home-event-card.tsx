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
import { type CSSProperties, useState, useSyncExternalStore } from "react";
import { EventCover } from "~/components/event-cover";
import { EventRegistrationButton } from "~/components/event-registration-button";
import { SeatsSentence } from "~/components/seats-sentence";
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

/** A ruled grid: every cell is outlined and pulled 1 px over its neighbours, so they share one line. */
export const RULED_GRID = "grid pt-px pl-px md:grid-cols-2";
export const RULED_CELL = "-mt-px -ml-px border border-navy";

/** The first cards stagger in; later ones rise as they scroll into view. */
const STAGGERED = 6;

let staggerStartedAt: number | undefined;

/**
 * How long ago the page's stagger started, so a list mounted later (the live list replacing the
 * server-rendered one, a filter change) joins it instead of replaying it. The server-rendered
 * cards start it on first paint; with none on the page it starts now.
 */
function staggerElapsedMs(): number {
	const now = document.timeline.currentTime;
	if (typeof now !== "number") return 0;
	if (staggerStartedAt === undefined) {
		const running = document
			.getAnimations()
			.find(
				(animation) =>
					animation instanceof CSSAnimation &&
					animation.animationName === "stagger-in",
			)?.startTime;
		staggerStartedAt = typeof running === "number" ? running : now;
	}
	return now - staggerStartedAt;
}

function subscribe() {
	return () => {};
}

/**
 * The stagger of a card that is among the first when it mounts, fixed for its life (a card that
 * later moves up the list does not replay it). The elapsed time is zero while hydrating, which
 * must match the server markup.
 */
function useStagger(index: number): CSSProperties | undefined {
	const hydrated = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
	const [stagger] = useState(() =>
		index < STAGGERED
			? ({
					"--stagger-index": index,
					"--stagger-elapsed": `${hydrated ? staggerElapsedMs() : 0}ms`,
				} as CSSProperties)
			: undefined,
	);
	return stagger;
}

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
	const stagger = useStagger(index);

	return (
		<article
			data-slot="card"
			className={cn(
				RULED_CELL,
				// `clip`, not `hidden`: the scroll reveal inside must keep the page as its scroller.
				"relative flex flex-col overflow-clip bg-white transition-[translate,box-shadow] duration-150 ease-out focus-within:z-10 focus-within:-translate-x-1 focus-within:-translate-y-1 focus-within:shadow-[6px_6px_0_0_var(--navy)] hover:z-10 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--navy)]",
			)}
		>
			{/* The contents rise inside the cell, so the grid lines never part while they move. */}
			<div
				className={cn(
					"flex flex-1 flex-col",
					stagger ? "stagger-in" : "scroll-reveal",
				)}
				style={stagger}
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
								viewTransition
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
						<SeatsSentence
							message={events_seats_remaining}
							remaining={seatsRemaining}
							max={maxSeats}
						/>
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
			className={cn(
				RULED_GRID,
				"transition-opacity data-[busy=true]:opacity-60",
			)}
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
