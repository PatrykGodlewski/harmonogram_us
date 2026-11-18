import type {
	EventDetailsData,
	EventDetailsRegistrations,
	ItemSeatCountSource,
} from "~/lib/event-details/types";
import type { EventSeatCount } from "~/lib/events/types";
import { AgendaTimeline } from "./agenda-timeline";
import { EventSummary } from "./event-summary";

export type EventDetailsViewProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventSeatCount: EventSeatCount;
	itemCounts: ItemSeatCountSource;
	registrations: EventDetailsRegistrations;
};

export function EventDetailsView({
	event,
	user,
	interactive,
	eventSeatCount,
	itemCounts,
	registrations,
}: EventDetailsViewProps) {
	const isClosed = new Date(event.effectiveEndsAt).getTime() <= Date.now();

	return (
		<div className="flex flex-col gap-8">
			<EventSummary
				event={event}
				user={user}
				interactive={interactive}
				isClosed={isClosed}
				seatCount={eventSeatCount}
				registrations={registrations}
			/>
			<AgendaTimeline
				event={event}
				user={user}
				interactive={interactive}
				eventClosed={isClosed}
				itemCounts={itemCounts}
				registrations={registrations}
			/>
		</div>
	);
}
