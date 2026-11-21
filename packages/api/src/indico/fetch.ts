import type { ImportedEvent } from "@repo/db/queries/indico-events";
import { z } from "zod";

/** Where to read events from: an Indico address, its categories and an optional API token. */
export type IndicoConfig = {
	baseUrl: string;
	categoryIds: string[];
	token?: string;
};

/** Past month and the coming year, as Indico's export API spells it. */
const WINDOW = { from: "-30d", to: "+365d", limit: "1000" };
const TIMEOUT_MS = 10_000;

const indicoDate = z.object({
	date: z.string(),
	time: z.string(),
	tz: z.string(),
});

const exportSchema = z.object({
	results: z.array(
		z.object({
			id: z.coerce.string(),
			title: z.string().min(1),
			startDate: indicoDate,
			endDate: indicoDate.nullish(),
			location: z.string().nullish(),
			room: z.string().nullish(),
		}),
	),
});

/**
 * Events of the configured categories from Indico's HTTP export API
 * (`/export/categ/{ids}.json`). Throws when Indico can't be read, so callers
 * keep what they had. Events with an id that isn't a number or a time zone we
 * don't know are skipped.
 */
export async function fetchIndicoEvents(
	config: IndicoConfig,
	fetchImpl: typeof fetch = fetch,
): Promise<ImportedEvent[]> {
	const base = config.baseUrl.endsWith("/")
		? config.baseUrl
		: `${config.baseUrl}/`;
	const url = new URL(
		`export/categ/${config.categoryIds.join("-")}.json`,
		base,
	);
	url.search = new URLSearchParams(WINDOW).toString();

	const response = await fetchImpl(url, {
		headers: config.token ? { authorization: `Bearer ${config.token}` } : {},
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Indico export answered ${response.status}`);
	}
	const { results } = exportSchema.parse(await response.json());

	return results.flatMap((event) => {
		if (!/^\d+$/.test(event.id)) {
			return [];
		}
		const startsAt = toUtc(event.startDate);
		if (!startsAt) {
			return [];
		}
		return [
			{
				id: event.id,
				title: event.title,
				startsAt,
				endsAt: event.endDate ? toUtc(event.endDate) : null,
				location: event.location || null,
				room: event.room || null,
				// Built here, never taken from the feed: the link always points at the configured Indico.
				url: new URL(`event/${event.id}/`, base).toString(),
			},
		];
	});
}

function toUtc(value: z.infer<typeof indicoDate>): Date | null {
	return zonedTimeToUtc(value.date, value.time, value.tz);
}

/** The instant of a wall-clock `date` + `time` in `timeZone`; null when either is invalid. */
export function zonedTimeToUtc(
	date: string,
	time: string,
	timeZone: string,
): Date | null {
	const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	const clock = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
	if (!day || !clock) {
		return null;
	}
	const wall = Date.UTC(
		Number(day[1]),
		Number(day[2]) - 1,
		Number(day[3]),
		Number(clock[1]),
		Number(clock[2]),
		Number(clock[3] ?? 0),
	);
	try {
		// The zone's offset at the first guess, then again at the result: right across DST changes.
		const first = wall - offsetAt(wall, timeZone);
		return new Date(wall - offsetAt(first, timeZone));
	} catch {
		return null;
	}
}

/** Milliseconds `timeZone` is ahead of UTC at `instant`. */
function offsetAt(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value);
	const asUtc = Date.UTC(
		part("year"),
		part("month") - 1,
		part("day"),
		part("hour"),
		part("minute"),
		part("second"),
	);
	return asUtc - (instant - (instant % 1000));
}
