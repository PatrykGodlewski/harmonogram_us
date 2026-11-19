import {
	event_details_full,
	event_details_places_left,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { AgendaCalendarGrid } from "@repo/ui/composed/agenda-calendar-grid";
import { formatEventTime } from "@repo/ui/time";
import * as React from "react";
import type {
	AgendaItemData,
	EventDetailsRegistrations,
	ItemSeatCount,
} from "~/lib/event-details/types";

type AgendaCalendarProps = {
	items: AgendaItemData[];
	seatCountOf: (item: AgendaItemData) => ItemSeatCount;
	registrations: EventDetailsRegistrations;
	/** False while the server-rendered view waits for live data: blocks can't be opened yet. */
	interactive: boolean;
	/** Renders the full row (details and registration) for the selected item. */
	renderDetails: (
		item: AgendaItemData & { parallel: boolean },
		as: "div",
	) => React.ReactNode;
};

const isFull = (seatCount: ItemSeatCount) =>
	seatCount.seatsRemaining !== null && seatCount.seatsRemaining <= 0;

/** The public agenda as a time grid; a tapped item opens with its registration. */
export function AgendaCalendar({
	items,
	seatCountOf,
	registrations,
	interactive,
	renderDetails,
}: AgendaCalendarProps) {
	const locale = getLocale();
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const selected = items.find((item) => item.id === selectedId);
	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setSelectedId(null);
		}
	};

	return (
		<>
			<AgendaCalendarGrid
				items={items}
				disabled={!interactive}
				onSelect={(item) => setSelectedId(item.id)}
				blockClassName={(item) =>
					registrations.registeredItemIds.has(item.id)
						? "border-primary bg-primary/10"
						: isFull(seatCountOf(item)) && "bg-muted text-muted-foreground"
				}
				renderBlock={(item) => {
					const seatCount = seatCountOf(item);
					return (
						<>
							<span className="tabular-nums text-muted-foreground">
								{formatEventTime(item.startsAt, locale)}–
								{formatEventTime(item.endsAt, locale)}
							</span>
							<span className="line-clamp-2 font-medium">{item.title}</span>
							{item.requiresRegistration && seatCount.maxSeats !== null ? (
								<span className="tabular-nums">
									{isFull(seatCount)
										? event_details_full()
										: event_details_places_left({
												remaining: seatCount.seatsRemaining ?? 0,
												max: seatCount.maxSeats,
											})}
								</span>
							) : null}
						</>
					);
				}}
			/>
			<Dialog open={selected !== undefined} onOpenChange={handleOpenChange}>
				<DialogContent>
					{selected ? (
						<>
							<DialogHeader className="sr-only">
								<DialogTitle>{selected.title}</DialogTitle>
							</DialogHeader>
							{renderDetails({ ...selected, parallel: false }, "div")}
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
