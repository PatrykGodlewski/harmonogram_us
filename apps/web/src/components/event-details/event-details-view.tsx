import { isEventClosed } from "~/lib/event-details/is-event-closed";
import type {
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import { AgendaTimeline } from "./agenda-timeline";
import { EventMaterials } from "./event-materials";
import { EventSummary } from "./event-summary";

export type EventDetailsViewProps = {
	event: EventDetailsData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	registrations: EventDetailsRegistrations;
};

export function EventDetailsView({
	event,
	user,
	interactive,
	registrations,
}: EventDetailsViewProps) {
	// Cancelled events close registration and say so at the top.
	const isCancelled = event.status === "cancelled";
	const isClosed = isEventClosed(event);

	return (
		<div className="flex flex-col gap-8">
			<EventSummary
				event={event}
				user={user}
				interactive={interactive}
				isClosed={isClosed}
				isCancelled={isCancelled}
				seatCount={{
					seatsRemaining: event.seatsRemaining,
					maxSeats: event.maxSeats,
				}}
				registrations={registrations}
			/>
			<EventMaterials event={event} />
			<AgendaTimeline
				event={event}
				user={user}
				interactive={interactive}
				eventClosed={isClosed}
				registrations={registrations}
			/>
		</div>
	);
}
