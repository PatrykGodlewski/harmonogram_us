import type {
	EventDetailsData,
	EventDetailsRegistrations,
	ItemSeatCountSource,
} from "~/lib/event-details/types";
import type { EventSeatCount } from "~/lib/events/types";
import { AgendaTimeline } from "./agenda-timeline";
import { EventMaterials } from "./event-materials";
import { EventSummary } from "./event-summary";

export type EventDetailsViewProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventSeatCount: EventSeatCount;
	itemCounts: ItemSeatCountSource;
	registrations: EventDetailsRegistrations;
	/** Cancelled events close registration and say so at the top. */
	isCancelled: boolean;
};

export function EventDetailsView({
	event,
	user,
	interactive,
	eventSeatCount,
	itemCounts,
	registrations,
	isCancelled,
}: EventDetailsViewProps) {
	const isClosed =
		isCancelled || new Date(event.effectiveEndsAt).getTime() <= Date.now();

	return (
		<div className="flex flex-col gap-8">
			<EventSummary
				event={event}
				user={user}
				interactive={interactive}
				isClosed={isClosed}
				isCancelled={isCancelled}
				seatCount={eventSeatCount}
				registrations={registrations}
			/>
			<EventMaterials event={event} />
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
