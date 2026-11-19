import { env } from "@repo/env/client";

/** Event and agenda times are shown and entered in the installation's time zone (`VITE_APP_TIME_ZONE`). */
export const EVENT_TIME_ZONE = env.VITE_APP_TIME_ZONE;

function toDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

export function formatEventDate(date: Date | string, locale: string): string {
	return toDate(date).toLocaleDateString(locale, {
		timeZone: EVENT_TIME_ZONE,
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatEventTime(date: Date | string, locale: string): string {
	return toDate(date).toLocaleTimeString(locale, {
		timeZone: EVENT_TIME_ZONE,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	});
}

/** "Nov 25, 2026, 10:00": date and time in the event time zone, the app's standard format. */
export function formatEventDateTime(
	date: Date | string,
	locale: string,
): string {
	return `${formatEventDate(date, locale)}, ${formatEventTime(date, locale)}`;
}

function zoneParts(date: Date): Record<string, string> {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: EVENT_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

/** `"YYYY-MM-DD"` for a date input, in the event time zone. */
export function toEventDateInput(date: Date): string {
	const parts = zoneParts(date);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

/** `"HH:mm"` for a time input, in the event time zone. */
export function toEventTimeInput(date: Date): string {
	const parts = zoneParts(date);
	return `${parts.hour}:${parts.minute}`;
}

/** Offset of the event time zone from UTC at `instant`, in milliseconds (e.g. +1h in winter). */
function zoneOffsetMs(instant: Date): number {
	const name = new Intl.DateTimeFormat("en-US", {
		timeZone: EVENT_TIME_ZONE,
		timeZoneName: "longOffset",
	})
		.formatToParts(instant)
		.find((part) => part.type === "timeZoneName")?.value;
	const match = name?.match(/GMT([+-])(\d{2}):(\d{2})/);
	if (!match) {
		return 0;
	}
	const [, sign, hours, minutes] = match;
	const ms = (Number(hours) * 60 + Number(minutes)) * 60_000;
	return sign === "-" ? -ms : ms;
}

/** Reads `date` (`YYYY-MM-DD`) and `time` (`HH:mm`) as wall-clock time in the event time zone. */
export function fromEventWallTime(date: string, time: string): Date {
	const [year, month, day] = date.split("-").map(Number);
	const [hour, minute] = time.split(":").map(Number);
	const asUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, minute);
	// Re-check the offset at the resulting instant to handle DST changes.
	const first = asUtc - zoneOffsetMs(new Date(asUtc));
	return new Date(asUtc - zoneOffsetMs(new Date(first)));
}
