import { agenda_now } from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import * as React from "react";
import { msUntilNextMinute } from "../agenda";
import { formatEventTime } from "../time";

/** A little past the minute, so a timer that fires early still lands in the new minute. */
const MINUTE_SLACK_MS = 50;

/**
 * The current time, updated at every full minute and whenever the tab becomes visible
 * again (background tabs delay timers). Null until mounted, so the server render and
 * the first client render agree (server and browser clocks differ).
 */
export function useNow(): Date | null {
	const [now, setNow] = React.useState<Date | null>(null);
	React.useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tick = () => {
			const current = new Date();
			setNow(current);
			clearTimeout(timer);
			timer = setTimeout(tick, msUntilNextMinute(current) + MINUTE_SLACK_MS);
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				tick();
			}
		};
		tick();
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);
	return now;
}

function nowLabel(now: Date): string {
	return `${agenda_now()}, ${formatEventTime(now, getLocale())}`;
}

/** "Now" between agenda list items: the ones above have started, the ones below haven't. */
export function AgendaNowDivider({ now }: { now: Date }) {
	return (
		<li className="flex items-center gap-2 py-1 text-xs font-medium text-destructive">
			<span className="size-2 bg-current" aria-hidden="true" />
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
			className="pointer-events-none absolute inset-x-0 z-10 flex items-center text-destructive"
			style={{ top }}
		>
			<span className="-ml-1 size-2 bg-current" aria-hidden="true" />
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
