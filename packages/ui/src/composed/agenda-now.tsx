import { agenda_now } from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import * as React from "react";
import { formatEventTime } from "../time";

const TICK_MS = 30_000;

/**
 * The current time, refreshed every 30 s; null until mounted, so the server render and the
 * first client render agree (server and browser clocks differ).
 */
export function useNow(): Date | null {
	const [now, setNow] = React.useState<Date | null>(null);
	React.useEffect(() => {
		setNow(new Date());
		const timer = setInterval(() => setNow(new Date()), TICK_MS);
		return () => clearInterval(timer);
	}, []);
	return now;
}

function nowLabel(now: Date): string {
	return `${agenda_now()}, ${formatEventTime(now, getLocale())}`;
}

/** "Now" between agenda list items: the ones above have started, the ones below haven't. */
export function AgendaNowDivider({ now }: { now: Date }) {
	return (
		<li className="flex items-center gap-2 py-1 text-xs font-medium text-red-600 dark:text-red-400">
			<span className="size-2 rounded-full bg-current" aria-hidden="true" />
			<span className="tabular-nums" aria-hidden="true">
				{nowLabel(now)}
			</span>
			<hr
				aria-label={nowLabel(now)}
				className="h-px flex-1 border-0 bg-current"
			/>
		</li>
	);
}

/** "Now" across the calendar grid, `top` pixels from the top of the day. */
export function AgendaNowLine({ now, top }: { now: Date; top: number }) {
	return (
		<div
			className="pointer-events-none absolute inset-x-0 z-10 flex items-center text-red-600 dark:text-red-400"
			style={{ top }}
		>
			<span
				className="-ml-1 size-2 rounded-full bg-current"
				aria-hidden="true"
			/>
			<hr
				aria-label={nowLabel(now)}
				className="h-0.5 flex-1 border-0 bg-current"
			/>
			{/* In the hour column on the left, so it never covers an item. */}
			<span
				className="absolute -left-12 w-12 -translate-y-px bg-background pr-2 text-right text-xs font-semibold tabular-nums"
				aria-hidden="true"
			>
				{formatEventTime(now, getLocale())}
			</span>
		</div>
	);
}
