import { getLocale } from "@repo/i18n/paraglide/runtime";
import type { ReactNode } from "react";
import { type AgendaLaidOut, type AgendaTimed, layoutAgenda } from "../agenda";
import { EVENT_TIME_ZONE, formatEventDate } from "../time";
import { cn } from "../utils";

/** Grid scale: pixels per minute; a block is never shorter than a touch target. */
const PX_PER_MINUTE = 1.6;
const MIN_BLOCK_PX = 44;

type AgendaCalendarGridProps<T extends AgendaTimed> = {
	items: T[];
	/** Called when a block is tapped. */
	onSelect: (item: T) => void;
	/** The block's content (time, title, places…); also its accessible name. */
	renderBlock: (item: AgendaLaidOut<T>) => ReactNode;
	/** Extra classes per block, e.g. to mark items the viewer registered for. */
	blockClassName?: (item: T) => string | false | undefined;
	/** True while blocks can't be opened yet (server-rendered view without live data). */
	disabled?: boolean;
};

/**
 * The agenda as a time grid, one per day in the installation time zone. Items that run
 * at the same time sit side by side; an item that runs alone uses the full width.
 */
export function AgendaCalendarGrid<T extends AgendaTimed>({
	items,
	onSelect,
	renderBlock,
	blockClassName,
	disabled = false,
}: AgendaCalendarGridProps<T>) {
	const locale = getLocale();
	const days = layoutAgenda(items, EVENT_TIME_ZONE, {
		minDurationMinutes: MIN_BLOCK_PX / PX_PER_MINUTE,
	});

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
								<button
									key={item.id}
									type="button"
									disabled={disabled}
									onClick={() => onSelect(item)}
									className={cn(
										"absolute flex flex-col gap-0.5 overflow-hidden rounded-md border bg-card p-1.5 text-left text-xs shadow-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
										blockClassName?.(item),
									)}
									style={{
										top: (item.startMinute - day.startMinute) * PX_PER_MINUTE,
										height: Math.max(
											MIN_BLOCK_PX,
											(item.endMinute - item.startMinute) * PX_PER_MINUTE - 2,
										),
										left: `calc(${(item.lane / item.lanes) * 100}% + 2px)`,
										width: `calc(${100 / item.lanes}% - 4px)`,
									}}
								>
									{renderBlock(item)}
								</button>
							))}
						</div>
					</div>
				</div>
			))}
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
