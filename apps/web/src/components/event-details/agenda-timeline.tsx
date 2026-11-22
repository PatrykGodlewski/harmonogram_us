import {
	event_details_agenda,
	event_details_no_agenda,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { findOverlaps, markParallel, nowListIndex } from "@repo/ui/agenda";
import { AgendaNowDivider, useNow } from "@repo/ui/composed/agenda-now";
import {
	type AgendaViewMode,
	AgendaViewToggle,
} from "@repo/ui/composed/agenda-view-toggle";
import { sessionColorClasses } from "@repo/ui/session-colors";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { getRouteApi } from "@tanstack/react-router";
import * as React from "react";
import type {
	AgendaItemData,
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import { AgendaCalendar } from "./agenda-calendar";
import { AgendaItemRow } from "./agenda-item-row";

const eventRoute = getRouteApi("/events/$eventId");

type AgendaTimelineProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventClosed: boolean;
	registrations: EventDetailsRegistrations;
};

/** The agenda as a list or a calendar; the choice lives in the URL (`?agenda=calendar`). */
export function AgendaTimeline({
	event,
	user,
	interactive,
	eventClosed,
	registrations,
}: AgendaTimelineProps) {
	const view: AgendaViewMode = eventRoute.useSearch().agenda ?? "list";
	const navigate = eventRoute.useNavigate();
	const handleViewChange = (next: AgendaViewMode) =>
		void navigate({
			search: (prev) => ({
				...prev,
				agenda: next === "list" ? undefined : next,
			}),
			replace: true,
			resetScroll: false,
		});

	const locale = getLocale();
	const sessionById = new Map(event.sessions.map((row) => [row.id, row]));
	// An item without a place of its own takes its session's.
	const agenda = event.agenda.map((item) =>
		item.locationLabel || !item.sessionId
			? item
			: {
					...item,
					locationLabel: sessionById.get(item.sessionId)?.locationLabel ?? null,
				},
	);
	const items = markParallel(agenda.filter((item) => !item.sessionId));
	const entries = [
		...event.sessions.map((session) => ({
			kind: "session" as const,
			session,
			startsAt: new Date(session.startsAt).getTime(),
		})),
		...items.map((item) => ({
			kind: "item" as const,
			item,
			startsAt: new Date(item.startsAt).getTime(),
		})),
	].sort((a, b) => a.startsAt - b.startsAt);
	const now = useNow();
	const nowIndex = now ? nowListIndex(items, now) : null;
	const overlaps = findOverlaps(event.agenda, registrations.registeredItemIds);
	const seatCountOf = (item: AgendaItemData) => ({
		seatsRemaining: item.seatsRemaining,
		maxSeats: item.maxSeats,
		registeredCount: item.registeredCount,
	});
	const renderRow = (
		item: AgendaItemData & { parallel: boolean },
		as: "li" | "div",
	) => (
		<AgendaItemRow
			key={item.id}
			as={as}
			item={item}
			files={event.files.filter((file) => file.agendaItemId === item.id)}
			eventId={event.id}
			user={user}
			interactive={interactive}
			eventClosed={eventClosed}
			seatCount={seatCountOf(item)}
			overlapsWith={overlaps.get(item.id)}
			registrations={registrations}
		/>
	);

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">{event_details_agenda()}</h2>
				{agenda.length > 0 ? (
					<AgendaViewToggle value={view} onChange={handleViewChange} />
				) : null}
			</div>
			{agenda.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_agenda()}</p>
			) : view === "calendar" ? (
				<AgendaCalendar
					items={agenda}
					sessions={event.sessions}
					seatCountOf={seatCountOf}
					registrations={registrations}
					interactive={interactive}
					renderDetails={renderRow}
				/>
			) : (
				<ol className="divide-y">
					{entries.map((entry) =>
						entry.kind === "session" ? (
							<li key={entry.session.id} className="py-3">
								<section
									aria-labelledby={`session-${entry.session.id}`}
									className="flex gap-3"
								>
									<span
										aria-hidden
										className={cn(
											"w-1.5 shrink-0 rounded-full",
											sessionColorClasses[entry.session.color].bar,
										)}
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<p className="text-sm text-muted-foreground tabular-nums">
											{formatEventTime(entry.session.startsAt, locale)}–
											{formatEventTime(entry.session.endsAt, locale)}
											{entry.session.locationLabel
												? ` · ${entry.session.locationLabel}`
												: ""}
										</p>
										<h3
											id={`session-${entry.session.id}`}
											className="font-semibold break-words"
										>
											{entry.session.title}
										</h3>
										{entry.session.description ? (
											<p className="text-sm text-muted-foreground break-words">
												{entry.session.description}
											</p>
										) : null}
										<ol className="divide-y">
											{markParallel(
												agenda.filter(
													(item) => item.sessionId === entry.session.id,
												),
											).map((item) => renderRow(item, "li"))}
										</ol>
									</div>
								</section>
							</li>
						) : (
							<React.Fragment key={entry.item.id}>
								{items.indexOf(entry.item) === nowIndex && now ? (
									<AgendaNowDivider now={now} />
								) : null}
								{renderRow(entry.item, "li")}
							</React.Fragment>
						),
					)}
					{nowIndex === items.length && now ? (
						<AgendaNowDivider now={now} />
					) : null}
				</ol>
			)}
		</section>
	);
}
