import {
	event_details_full,
	event_details_places_left,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { type AgendaLaidOut, layoutAgenda } from "@repo/ui/agenda";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	EVENT_TIME_ZONE,
	formatEventDate,
	formatEventTime,
} from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import * as React from "react";
import type {
	AgendaItemData,
	EventDetailsRegistrations,
	ItemSeatCount,
} from "~/lib/event-details/types";

/** Grid scale: pixels per minute; a block is never shorter than a touch target. */
const PX_PER_MINUTE = 1.6;
const MIN_BLOCK_PX = 44;

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

/** The agenda as a time grid: one column per parallel session, a dialog for details. */
export function AgendaCalendar({
	items,
	seatCountOf,
	registrations,
	interactive,
	renderDetails,
}: AgendaCalendarProps) {
	const locale = getLocale();
	const days = layoutAgenda(items, EVENT_TIME_ZONE);
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const selected = items.find((item) => item.id === selectedId);
	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setSelectedId(null);
		}
	};

	return (
		<div className="flex flex-col gap-6">
			{days.map((day) => (
				<div key={day.day} className="flex flex-col gap-2">
					{days.length > 1 ? (
						<h3 className="text-sm font-medium">
							{formatEventDate(day.items[0]?.startsAt ?? day.day, locale)}
						</h3>
					) : null}
					<div className="flex">
						<HourLabels
							startMinute={day.startMinute}
							endMinute={day.endMinute}
						/>
						<div
							className="relative flex-1 border-l"
							style={{
								height: (day.endMinute - day.startMinute) * PX_PER_MINUTE,
							}}
						>
							<HourLines
								startMinute={day.startMinute}
								endMinute={day.endMinute}
							/>
							{day.items.map((item) => (
								<CalendarBlock
									key={item.id}
									item={item}
									dayStartMinute={day.startMinute}
									seatCount={seatCountOf(item)}
									registered={registrations.registeredItemIds.has(item.id)}
									disabled={!interactive}
									onSelect={() => setSelectedId(item.id)}
								/>
							))}
						</div>
					</div>
				</div>
			))}
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
		</div>
	);
}

function hoursBetween(startMinute: number, endMinute: number): number[] {
	const hours: number[] = [];
	for (let minute = startMinute; minute < endMinute; minute += 60) {
		hours.push(minute);
	}
	return hours;
}

function HourLabels({
	startMinute,
	endMinute,
}: {
	startMinute: number;
	endMinute: number;
}) {
	return (
		<div
			aria-hidden="true"
			className="relative w-12 shrink-0 text-xs text-muted-foreground tabular-nums"
			style={{ height: (endMinute - startMinute) * PX_PER_MINUTE }}
		>
			{hoursBetween(startMinute, endMinute).map((minute) => (
				<span
					key={minute}
					className="absolute right-2 -translate-y-1/2 first:translate-y-0"
					style={{ top: (minute - startMinute) * PX_PER_MINUTE }}
				>
					{String(Math.floor(minute / 60) % 24).padStart(2, "0")}:00
				</span>
			))}
		</div>
	);
}

function HourLines({
	startMinute,
	endMinute,
}: {
	startMinute: number;
	endMinute: number;
}) {
	return hoursBetween(startMinute, endMinute).map((minute) => (
		<div
			key={minute}
			aria-hidden="true"
			className="absolute inset-x-0 border-t border-dashed"
			style={{ top: (minute - startMinute) * PX_PER_MINUTE }}
		/>
	));
}

type CalendarBlockProps = {
	item: AgendaLaidOut<AgendaItemData>;
	dayStartMinute: number;
	seatCount: ItemSeatCount;
	registered: boolean;
	disabled: boolean;
	onSelect: () => void;
};

function CalendarBlock({
	item,
	dayStartMinute,
	seatCount,
	registered,
	disabled,
	onSelect,
}: CalendarBlockProps) {
	const locale = getLocale();
	const isFull =
		seatCount.seatsRemaining !== null && seatCount.seatsRemaining <= 0;
	const limited = item.requiresRegistration && seatCount.maxSeats !== null;

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onSelect}
			className={cn(
				"absolute flex flex-col gap-0.5 overflow-hidden rounded-md border bg-card p-1.5 text-left text-xs shadow-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
				registered && "border-primary bg-primary/10",
				isFull && !registered && "bg-muted text-muted-foreground",
			)}
			style={{
				top: (item.startMinute - dayStartMinute) * PX_PER_MINUTE,
				height: Math.max(
					MIN_BLOCK_PX,
					(item.endMinute - item.startMinute) * PX_PER_MINUTE - 2,
				),
				left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
				width: `calc(${100 / item.lanes}% - 4px)`,
			}}
		>
			<span className="tabular-nums text-muted-foreground">
				{formatEventTime(item.startsAt, locale)}–
				{formatEventTime(item.endsAt, locale)}
			</span>
			<span className="line-clamp-2 font-medium">{item.title}</span>
			{limited ? (
				<span className="tabular-nums">
					{isFull
						? event_details_full()
						: event_details_places_left({
								remaining: seatCount.seatsRemaining ?? 0,
								max: seatCount.maxSeats ?? 0,
							})}
				</span>
			) : null}
		</button>
	);
}
