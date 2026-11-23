import type { EventDetails } from "@repo/api/events/queries";
import {
	event_details_full,
	event_details_places_left,
	event_details_sessions,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { AgendaCalendarGrid } from "@repo/ui/composed/agenda-calendar-grid";
import { sessionColorClasses } from "@repo/ui/session-colors";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import * as React from "react";
import type {
	AgendaItemData,
	EventDetailsRegistrations,
	ItemSeatCount,
} from "~/lib/event-details/types";

type AgendaCalendarProps = {
	items: AgendaItemData[];
	/** Items of a session take its colour; the legend names each session (F33). */
	sessions: EventDetails["sessions"];
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
	sessions,
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

	const colorOf = new Map(sessions.map((row) => [row.id, row.color]));
	const sessionBorder = (item: AgendaItemData) => {
		const color = item.sessionId ? colorOf.get(item.sessionId) : undefined;
		return color ? sessionColorClasses[color].border : undefined;
	};

	return (
		<>
			{sessions.length > 0 ? (
				<ul
					aria-label={event_details_sessions()}
					className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
				>
					{sessions.map((session) => (
						<li key={session.id} className="flex items-center gap-1.5">
							<span
								aria-hidden
								className={cn(
									"size-3 rounded-full",
									sessionColorClasses[session.color].bar,
								)}
							/>
							{session.title}
						</li>
					))}
				</ul>
			) : null}
			<AgendaCalendarGrid
				items={items}
				disabled={!interactive}
				onSelect={(item) => setSelectedId(item.id)}
				blockClassName={(item) =>
					cn(
						registrations.registeredItemIds.has(item.id)
							? "border-primary bg-primary/10"
							: isFull(seatCountOf(item)) && "bg-muted text-muted-foreground",
						sessionBorder(item),
					)
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
