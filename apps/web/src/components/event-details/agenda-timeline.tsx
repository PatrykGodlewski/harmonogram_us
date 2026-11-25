import {
	event_details_agenda,
	event_details_all_days,
	event_details_all_places,
	event_details_day,
	event_details_no_agenda,
	event_details_no_match,
	event_details_place,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	entriesByDay,
	filterByDay,
	filterByPlace,
	filterBySession,
	findOverlaps,
	programmeDays,
	programmeEntries,
	programmeNowIndex,
	programmePlaces,
	programmeSessionTitles,
} from "@repo/ui/agenda";
import { AgendaNowDivider, useNow } from "@repo/ui/composed/agenda-now";
import {
	type AgendaViewMode,
	AgendaViewToggle,
} from "@repo/ui/composed/agenda-view-toggle";
import {
	EVENT_TIME_ZONE,
	formatEventDay,
	formatEventDayLong,
	toEventDateInput,
} from "@repo/ui/time";
import { getRouteApi } from "@tanstack/react-router";
import * as React from "react";
import { itemSeatCount } from "~/lib/event-details/item-seats";
import type {
	AgendaItemData,
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import { AgendaCalendar } from "./agenda-calendar";
import { AgendaFilterChips } from "./agenda-filter-chips";
import { AgendaItemRow } from "./agenda-item-row";
import { AgendaSessionBlock } from "./agenda-session-block";
import { AgendaSessionFilter } from "./agenda-session-filter";

/** More items than this on screen, and sessions start folded to their header. */
const FOLD_ABOVE_ITEMS = 10;

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
	const titles = programmeSessionTitles(event.sessions);
	const sessionTitle =
		search.session && titles.includes(search.session) ? search.session : null;
	const handleSessionChange = (next: string | null) =>
		void navigate({
			search: (prev) => ({ ...prev, session: next ?? undefined }),
			replace: true,
			resetScroll: false,
		});
	// The days of the whole programme, each with a moment on it to name it by.
	const days = programmeDays(agenda, event.sessions, EVENT_TIME_ZONE);
	const momentOf = new Map<string, Date | string>();
	for (const entry of [...event.sessions, ...agenda]) {
		const key = toEventDateInput(new Date(entry.startsAt));
		if (!momentOf.has(key)) momentOf.set(key, entry.startsAt);
	}
	const day = search.day && days.includes(search.day) ? search.day : null;
	const handleDayChange = (next: string | null) =>
		void navigate({
			search: (prev) => ({ ...prev, day: next ?? undefined }),
			replace: true,
			resetScroll: false,
		});
	const inPlace = filterByPlace(agenda, event.sessions, place);
	const inSession = filterBySession(
		inPlace.items,
		inPlace.sessions,
		sessionTitle,
	);
	const shown = filterByDay(
		inSession.items,
		inSession.sessions,
		day,
		EVENT_TIME_ZONE,
	);
	const entries = programmeEntries(shown.items, shown.sessions);
	const multiDay = days.length > 1;
	const groups = multiDay
		? entriesByDay(entries, EVENT_TIME_ZONE)
		: [{ day: "", entries }];
	const folded = shown.items.length > FOLD_ABOVE_ITEMS && sessionTitle === null;
	const now = useNow();
	const nowIndex = now ? programmeNowIndex(entries, now) : null;
	const overlaps = findOverlaps(event.agenda, registrations.registeredItemIds);
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
			seatCount={itemSeatCount(item)}
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
			{multiDay || places.length > 1 || titles.length > 1 ? (
				<div className="flex flex-col gap-2">
					{multiDay ? (
						<AgendaFilterChips
							label={event_details_day()}
							allLabel={event_details_all_days()}
							options={days.map((key) => ({
								id: key,
								label: formatEventDay(momentOf.get(key) ?? key, locale),
							}))}
							value={day}
							onChange={handleDayChange}
						/>
					) : null}
					{places.length > 1 ? (
						<AgendaFilterChips
							label={event_details_place()}
							allLabel={event_details_all_places()}
							options={places}
							value={place}
							onChange={handlePlaceChange}
						/>
					) : null}
					{titles.length > 1 ? (
						<AgendaSessionFilter
							titles={titles}
							value={sessionTitle}
							onChange={handleSessionChange}
						/>
					) : null}
				</div>
			) : null}
			{agenda.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_agenda()}</p>
			) : entries.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_match()}</p>
			) : view === "calendar" ? (
				<AgendaCalendar
					items={shown.items}
					sessions={shown.sessions}
					seatCountOf={itemSeatCount}
					registrations={registrations}
					interactive={interactive}
					renderDetails={renderRow}
				/>
			) : (
				<div className="flex flex-col gap-4">
					{groups.map((group) => (
						<div key={group.day || "all"} className="flex flex-col gap-1">
							{multiDay ? (
								<h3 className="font-semibold first-letter:uppercase">
									{formatEventDayLong(
										momentOf.get(group.day) ?? group.day,
										locale,
									)}
								</h3>
							) : null}
							<ol className="divide-y">
								{group.entries.map((entry) => {
									const index = entries.indexOf(entry);
									return (
										<React.Fragment
											key={
												entry.kind === "session"
													? entry.session.id
													: entry.item.id
											}
										>
											{index === nowIndex && now ? (
												<AgendaNowDivider now={now} />
											) : null}
											{entry.kind === "session" ? (
												<AgendaSessionBlock
													// A new fold rule (filters changed) starts the block afresh.
													key={String(folded)}
													session={entry.session}
													itemCount={entry.items.length}
													headingLevel={multiDay ? 4 : 3}
													defaultFolded={folded}
													locale={locale}
												>
													{entry.items.map((item) => renderRow(item, "li"))}
												</AgendaSessionBlock>
											) : (
												renderRow(entry.item, "li")
											)}
										</React.Fragment>
									);
								})}
								{group === groups.at(-1) &&
								nowIndex === entries.length &&
								now ? (
									<AgendaNowDivider now={now} />
								) : null}
							</ol>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
