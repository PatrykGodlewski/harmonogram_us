import {
	event_details_agenda,
	event_details_no_agenda,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	filterByPlace,
	findOverlaps,
	programmeEntries,
	programmeNowIndex,
	programmePlaces,
} from "@repo/ui/agenda";
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
import { AgendaPlaceFilter } from "./agenda-place-filter";

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
	const search = eventRoute.useSearch();
	const view: AgendaViewMode = search.agenda ?? "list";
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
	const places = programmePlaces(agenda, event.sessions);
	const place = places.some((row) => row.id === search.place)
		? (search.place ?? null)
		: null;
	const handlePlaceChange = (next: string | null) =>
		void navigate({
			search: (prev) => ({ ...prev, place: next ?? undefined }),
			replace: true,
			resetScroll: false,
		});
	const shown = filterByPlace(agenda, event.sessions, place);
	const entries = programmeEntries(shown.items, shown.sessions);
	const now = useNow();
	const nowIndex = now ? programmeNowIndex(entries, now) : null;
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
			{places.length > 1 ? (
				<AgendaPlaceFilter
					places={places}
					value={place}
					onChange={handlePlaceChange}
				/>
			) : null}
			{agenda.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_agenda()}</p>
			) : view === "calendar" ? (
				<AgendaCalendar
					items={shown.items}
					sessions={shown.sessions}
					seatCountOf={seatCountOf}
					registrations={registrations}
					interactive={interactive}
					renderDetails={renderRow}
				/>
			) : (
				<ol className="divide-y">
					{entries.map((entry, index) => (
						<React.Fragment
							key={entry.kind === "session" ? entry.session.id : entry.item.id}
						>
							{index === nowIndex && now ? (
								<AgendaNowDivider now={now} />
							) : null}
							{entry.kind === "session" ? (
								<li className="py-3">
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
												{entry.items.map((item) => renderRow(item, "li"))}
											</ol>
										</div>
									</section>
								</li>
							) : (
								renderRow(entry.item, "li")
							)}
						</React.Fragment>
					))}
					{nowIndex === entries.length && now ? (
						<AgendaNowDivider now={now} />
					) : null}
				</ol>
			)}
		</section>
	);
}
