import { calendar_scroll_hint } from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import type { ReactNode } from "react";
import {
	type AgendaLaidOut,
	type AgendaTimed,
	layoutAgenda,
	nowMinuteOnDay,
} from "../agenda";
import { EVENT_TIME_ZONE, formatEventDayLong } from "../time";
import { cn } from "../utils";
import { AgendaNowLine, useNow } from "./agenda-now";

/** Grid scale: pixels per minute; a block is never shorter than a touch target. */
const PX_PER_MINUTE = 1.6;
const MIN_BLOCK_PX = 44;
/** Parallel items never get narrower than this: the day scrolls sideways instead. */
const LANE_MIN_PX = 152;
/** Width of the hour labels column. */
const HOURS_PX = 48;

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
 * at the same time sit side by side, each at least LANE_MIN_PX wide (a busy day scrolls
 * sideways, its hours pinned on the left); an item that runs alone uses the full width.
 */
export function AgendaCalendarGrid<T extends AgendaTimed>({
	items,
	onSelect,
	renderBlock,
	blockClassName,
	disabled = false,
}: AgendaCalendarGridProps<T>) {
	const locale = getLocale();
	const now = useNow();
	const days = layoutAgenda(items, EVENT_TIME_ZONE, {
		minDurationMinutes: MIN_BLOCK_PX / PX_PER_MINUTE,
	});

	return (
		<div className="flex flex-col gap-6">
			{days.map((day) => {
				const lanes = Math.max(1, ...day.items.map((item) => item.lanes));
				return (
					<section key={day.day} className="flex flex-col gap-2">
						{days.length > 1 ? (
							<h3 className="border border-navy bg-navy px-3 py-1.5 font-mono text-xs font-bold tracking-widest text-manela uppercase">
								{formatEventDayLong(day.items[0]?.startsAt ?? day.day, locale)}
							</h3>
						) : null}
						{lanes >= 3 ? (
							<p className={cn("font-mono text-xs", lanes <= 4 && "md:hidden")}>
								{calendar_scroll_hint()} <span aria-hidden>→</span>
							</p>
						) : null}
						<div className="flex overflow-x-auto overscroll-x-contain border border-navy bg-white">
							<HourLabels
								startMinute={day.startMinute}
								endMinute={day.endMinute}
							/>
							<div
								className="relative flex-1 border-l border-navy"
								style={{
									height: (day.endMinute - day.startMinute) * PX_PER_MINUTE,
									minWidth: lanes * LANE_MIN_PX,
								}}
							>
								<HourLines
									startMinute={day.startMinute}
									endMinute={day.endMinute}
								/>
								{now ? (
									<NowLine
										now={now}
										startMinute={day.startMinute}
										minute={nowMinuteOnDay(day, now, EVENT_TIME_ZONE)}
									/>
								) : null}
								{day.items.map((item) => (
									<button
										key={item.id}
										type="button"
										disabled={disabled}
										onClick={() => onSelect(item)}
										className={cn(
											"absolute flex flex-col gap-0.5 overflow-hidden border border-l-4 border-navy bg-white p-1.5 text-left text-xs transition-[translate,box-shadow] duration-100 ease-out hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--navy)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-navy",
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
					</section>
				);
			})}
		</div>
	);
}

function NowLine({
	now,
	startMinute,
	minute,
}: {
	now: Date;
	startMinute: number;
	minute: number | null;
}) {
	return minute === null ? null : (
		<AgendaNowLine now={now} top={(minute - startMinute) * PX_PER_MINUTE} />
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
			className="sticky left-0 z-20 shrink-0 bg-white font-mono text-xs tabular-nums"
			style={{
				height: (endMinute - startMinute) * PX_PER_MINUTE,
				width: HOURS_PX,
			}}
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
			className="absolute inset-x-0 border-t border-dashed border-navy/30"
			style={{ top: (minute - startMinute) * PX_PER_MINUTE }}
		/>
	));
}
