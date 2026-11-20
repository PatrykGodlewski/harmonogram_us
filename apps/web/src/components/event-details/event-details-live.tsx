import { ensureAgendaItemSeatCountsSync } from "@repo/collections/agenda-item-seat-counts";
import { useEffect } from "react";
import { useLiveAgendaCounts } from "~/lib/event-details/use-live-agenda-counts";
import { useEventCancelled } from "~/lib/events/use-event-cancelled";
import { useEventSeatCounts } from "~/lib/events/use-event-seat-counts";
import {
	EventDetailsView,
	type EventDetailsViewProps,
} from "./event-details-view";

type EventDetailsLiveProps = Omit<
	EventDetailsViewProps,
	"interactive" | "itemCounts" | "isCancelled"
>;

/** Client-only: live Electric seat counts for the event and its agenda items. */
export default function EventDetailsLive(props: EventDetailsLiveProps) {
	useEffect(() => {
		void ensureAgendaItemSeatCountsSync();
	}, []);

	const eventCounts = useEventSeatCounts();
	const itemCounts = useLiveAgendaCounts();
	const isCancelled = useEventCancelled(props.event.id, props.event.status);

	return (
		<EventDetailsView
			{...props}
			interactive
			eventSeatCount={eventCounts.getDisplaySeatCount(
				props.event.id,
				props.eventSeatCount,
			)}
			itemCounts={itemCounts}
			isCancelled={isCancelled}
		/>
	);
}
