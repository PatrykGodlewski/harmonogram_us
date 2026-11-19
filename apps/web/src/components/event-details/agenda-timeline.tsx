import {
	event_details_agenda,
	event_details_no_agenda,
} from "@repo/i18n/paraglide/messages";
import { findOverlaps, markParallel, nowListIndex } from "@repo/ui/agenda";
import { AgendaNowDivider, useNow } from "@repo/ui/composed/agenda-now";
import {
	type AgendaViewMode,
	AgendaViewToggle,
} from "@repo/ui/composed/agenda-view-toggle";
import { getRouteApi } from "@tanstack/react-router";
import * as React from "react";
import type {
	AgendaItemData,
	EventDetailsData,
	EventDetailsRegistrations,
	ItemSeatCountSource,
} from "~/lib/event-details/types";
import { AgendaCalendar } from "./agenda-calendar";
import { AgendaItemRow } from "./agenda-item-row";

const eventRoute = getRouteApi("/events/$eventId");

type AgendaTimelineProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventClosed: boolean;
	itemCounts: ItemSeatCountSource;
	registrations: EventDetailsRegistrations;
};

/** The agenda as a list or a calendar; the choice lives in the URL (`?agenda=calendar`). */
export function AgendaTimeline({
	event,
	user,
	interactive,
	eventClosed,
	itemCounts,
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

	const items = markParallel(event.agenda);
	const now = useNow();
	const nowIndex = now ? nowListIndex(items, now) : null;
	const overlaps = findOverlaps(event.agenda, registrations.registeredItemIds);
	const seatCountOf = (item: AgendaItemData) =>
		itemCounts.getItemCount(item.id, {
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
				{items.length > 0 ? (
					<AgendaViewToggle value={view} onChange={handleViewChange} />
				) : null}
			</div>
			{items.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_agenda()}</p>
			) : view === "calendar" ? (
				<AgendaCalendar
					items={event.agenda}
					seatCountOf={seatCountOf}
					registrations={registrations}
					interactive={interactive}
					renderDetails={renderRow}
				/>
			) : (
				<ol className="divide-y">
					{items.map((item, index) => (
						<React.Fragment key={item.id}>
							{index === nowIndex && now ? (
								<AgendaNowDivider now={now} />
							) : null}
							{renderRow(item, "li")}
						</React.Fragment>
					))}
					{nowIndex === items.length && now ? (
						<AgendaNowDivider now={now} />
					) : null}
				</ol>
			)}
		</section>
	);
}
