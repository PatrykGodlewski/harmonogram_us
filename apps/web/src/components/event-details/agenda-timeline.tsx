import {
	event_details_agenda,
	event_details_no_agenda,
} from "@repo/i18n/paraglide/messages";
import { findOverlaps, markParallel } from "@repo/ui/agenda";
import type {
	EventDetailsData,
	EventDetailsRegistrations,
	ItemSeatCountSource,
} from "~/lib/event-details/types";
import { AgendaItemRow } from "./agenda-item-row";

type AgendaTimelineProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventClosed: boolean;
	itemCounts: ItemSeatCountSource;
	registrations: EventDetailsRegistrations;
};

export function AgendaTimeline({
	event,
	user,
	interactive,
	eventClosed,
	itemCounts,
	registrations,
}: AgendaTimelineProps) {
	const items = markParallel(event.agenda);
	const overlaps = findOverlaps(event.agenda, registrations.registeredItemIds);

	return (
		<section className="flex flex-col gap-2">
			<h2 className="text-lg font-semibold">{event_details_agenda()}</h2>
			{items.length === 0 ? (
				<p className="text-muted-foreground">{event_details_no_agenda()}</p>
			) : (
				<ol className="divide-y">
					{items.map((item) => (
						<AgendaItemRow
							key={item.id}
							item={item}
							eventId={event.id}
							user={user}
							interactive={interactive}
							eventClosed={eventClosed}
							seatCount={itemCounts.getItemCount(item.id, {
								seatsRemaining: item.seatsRemaining,
								maxSeats: item.maxSeats,
								registeredCount: item.registeredCount,
							})}
							overlapsWith={overlaps.get(item.id)}
							registrations={registrations}
						/>
					))}
				</ol>
			)}
		</section>
	);
}
