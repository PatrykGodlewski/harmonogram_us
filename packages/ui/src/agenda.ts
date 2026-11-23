export type AgendaTimed = {
	id: string;
	title: string;
	startsAt: Date | string;
	endsAt: Date | string;
};

const ms = (value: Date | string) => new Date(value).getTime();

function sortByStart<T extends AgendaTimed>(items: T[]): T[] {
	return [...items].sort(
		(a, b) => ms(a.startsAt) - ms(b.startsAt) || a.title.localeCompare(b.title),
	);
}

/** Sorts by start, then title, and flags items that start while an earlier item is still running. */
export function markParallel<T extends AgendaTimed>(
	items: T[],
): Array<T & { parallel: boolean }> {
	let latestEnd = Number.NEGATIVE_INFINITY;
	return sortByStart(items).map((item) => {
		const parallel = latestEnd > ms(item.startsAt);
		latestEnd = Math.max(latestEnd, ms(item.endsAt));
		return { ...item, parallel };
	});
}

/** Maps each selected item id to the titles of other selected items it overlaps. Touching items don't overlap. */
export function findOverlaps<T extends AgendaTimed>(
	items: T[],
	selectedIds: ReadonlySet<string>,
): Map<string, string[]> {
	const selected = sortByStart(
		items.filter((item) => selectedIds.has(item.id)),
	);
	const overlaps = new Map<string, string[]>();

	for (const a of selected) {
		for (const b of selected) {
			if (
				a.id !== b.id &&
				ms(a.startsAt) < ms(b.endsAt) &&
				ms(b.startsAt) < ms(a.endsAt)
			) {
				overlaps.set(a.id, [...(overlaps.get(a.id) ?? []), b.title]);
			}
		}
	}
	return overlaps;
}

export type AgendaLaidOut<T> = T & {
	/** 0-based column among items that run at the same time. */
	lane: number;
	/** Columns in this item's block of overlapping items (1 when it runs alone). */
	lanes: number;
	/** Minutes since midnight of the item's day, in the layout's time zone. */
	startMinute: number;
	endMinute: number;
};

export type AgendaDay<T> = {
	/** YYYY-MM-DD in the layout's time zone. */
	day: string;
	/** Whole hours around the day's items, in minutes since midnight. */
	startMinute: number;
	endMinute: number;
	/** Most columns any block of overlapping items on the day needs. */
	lanes: number;
	items: AgendaLaidOut<T>[];
};

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "00";
	return {
		day: `${get("year")}-${get("month")}-${get("day")}`,
		minute: Number(get("hour")) * 60 + Number(get("minute")),
	};
}

/**
 * Splits the agenda into days (in `timeZone`) and gives each item a column, so items
 * that run at the same time sit side by side. An item takes the lowest column whose
 * last item has ended; items that only touch share a column.
 */
export function layoutAgenda<T extends AgendaTimed>(
	items: T[],
	timeZone: string,
	/** minDurationMinutes: the shortest an item is drawn; lanes follow the drawn size. */
	options: { minDurationMinutes?: number } = {},
): AgendaDay<T>[] {
	const minDuration = options.minDurationMinutes ?? 0;
	const drawnEnd = (item: { startMinute: number; endMinute: number }) =>
		Math.max(item.endMinute, item.startMinute + minDuration);
	const days = new Map<string, AgendaLaidOut<T>[]>();
	for (const item of sortByStart(items)) {
		const start = zonedParts(new Date(item.startsAt), timeZone);
		const durationMinutes = Math.round(
			(ms(item.endsAt) - ms(item.startsAt)) / 60_000,
		);
		const laid = {
			...item,
			lane: 0,
			lanes: 1,
			startMinute: start.minute,
			endMinute: start.minute + durationMinutes,
		};
		days.set(start.day, [...(days.get(start.day) ?? []), laid]);
	}

	return [...days].map(([day, dayItems]) => {
		// A block is a run of items connected by overlaps; columns are counted per block,
		// so an item that runs alone keeps the full width.
		let laneEnds: number[] = [];
		let block: AgendaLaidOut<T>[] = [];
		let maxLanes = 1;
		const closeBlock = () => {
			for (const member of block) {
				member.lanes = laneEnds.length;
			}
			maxLanes = Math.max(maxLanes, laneEnds.length);
			laneEnds = [];
			block = [];
		};
		for (const item of dayItems) {
			if (block.length > 0 && Math.max(...laneEnds) <= item.startMinute) {
				closeBlock();
			}
			const free = laneEnds.findIndex((end) => end <= item.startMinute);
			item.lane = free === -1 ? laneEnds.length : free;
			laneEnds[item.lane] = drawnEnd(item);
			block.push(item);
		}
		closeBlock();
		return {
			day,
			startMinute:
				Math.floor(Math.min(...dayItems.map((i) => i.startMinute)) / 60) * 60,
			endMinute: Math.ceil(Math.max(...dayItems.map(drawnEnd)) / 60) * 60,
			lanes: maxLanes,
			items: dayItems,
		};
	});
}

/** Minutes since midnight of `now` on this agenda day, or null when now is another day or outside its hours. */
export function nowMinuteOnDay<T>(
	day: AgendaDay<T>,
	now: Date,
	timeZone: string,
): number | null {
	const parts = zonedParts(now, timeZone);
	if (parts.day !== day.day) {
		return null;
	}
	return parts.minute >= day.startMinute && parts.minute <= day.endMinute
		? parts.minute
		: null;
}

/**
 * Where "now" goes in the agenda list sorted by start (the number of items that have
 * started), or null when the agenda isn't running (before its first start or after its last end).
 */
export function nowListIndex<T extends AgendaTimed>(
	items: T[],
	now: Date,
): number | null {
	const sorted = sortByStart(items);
	const first = sorted[0];
	const lastEnd = Math.max(...sorted.map((item) => ms(item.endsAt)));
	const time = now.getTime();
	if (!first || time < ms(first.startsAt) || time > lastEnd) {
		return null;
	}
	return sorted.filter((item) => ms(item.startsAt) <= time).length;
}

/** One line of a programme with sessions (F33): a session with its items, or an item outside any session. */
export type ProgrammeEntry<I, S> =
	| { kind: "session"; session: S; items: Array<I & { parallel: boolean }> }
	| { kind: "item"; item: I & { parallel: boolean } };

/** Sessions and the items outside them, in order of start; each session carries its items. */
export function programmeEntries<
	I extends AgendaTimed & { sessionId: string | null },
	S extends AgendaTimed,
>(items: I[], sessions: S[]): ProgrammeEntry<I, S>[] {
	const timed = [
		...sessions.map((session) => ({
			...session,
			entry: {
				kind: "session" as const,
				session,
				items: markParallel(
					items.filter((item) => item.sessionId === session.id),
				),
			},
		})),
		...markParallel(items.filter((item) => item.sessionId === null)).map(
			(item) => ({ ...item, entry: { kind: "item" as const, item } }),
		),
	];
	return sortByStart(timed).map(({ entry }) => entry);
}

/** Where "now" goes among programme entries (a session counts by its own times), as `nowListIndex`. */
export function programmeNowIndex<I extends AgendaTimed, S extends AgendaTimed>(
	entries: ProgrammeEntry<I, S>[],
	now: Date,
): number | null {
	return nowListIndex(
		entries.map((entry) =>
			entry.kind === "session" ? entry.session : entry.item,
		),
		now,
	);
}

type Placed = { locationId: string | null; locationLabel: string | null };

/** An item's place: its own, else its session's. */
function placeOf<
	I extends Placed & { sessionId: string | null },
	S extends AgendaTimed & Placed,
>(item: I, sessionById: Map<string, S>): Placed {
	if (item.locationId || !item.sessionId) {
		return item;
	}
	return sessionById.get(item.sessionId) ?? item;
}

/** The distinct places of a programme, in order of first use (items take their session's place). */
export function programmePlaces<
	I extends AgendaTimed & Placed & { sessionId: string | null },
	S extends AgendaTimed & Placed,
>(items: I[], sessions: S[]): { id: string; label: string }[] {
	const sessionById = new Map(sessions.map((session) => [session.id, session]));
	const timed = [
		...sessions,
		...items.map((item) => ({ ...item, ...placeOf(item, sessionById) })),
	];
	const places = new Map<string, string>();
	for (const entry of sortByStart(timed)) {
		if (entry.locationId && !places.has(entry.locationId)) {
			places.set(entry.locationId, entry.locationLabel ?? entry.locationId);
		}
	}
	return [...places].map(([id, label]) => ({ id, label }));
}

/**
 * The part of a programme held in one place: items whose place matches, and sessions
 * that have such an item or are held there themselves. `placeId` null keeps everything.
 */
export function filterByPlace<
	I extends AgendaTimed & Placed & { sessionId: string | null },
	S extends AgendaTimed & Placed,
>(
	items: I[],
	sessions: S[],
	placeId: string | null,
): { items: I[]; sessions: S[] } {
	if (placeId === null) {
		return { items, sessions };
	}
	const sessionById = new Map(sessions.map((session) => [session.id, session]));
	const kept = items.filter(
		(item) => placeOf(item, sessionById).locationId === placeId,
	);
	return {
		items: kept,
		sessions: sessions.filter(
			(session) =>
				session.locationId === placeId ||
				kept.some((item) => item.sessionId === session.id),
		),
	};
}

/** Milliseconds until the next full minute (when a clock showing HH:MM must change). */
export function msUntilNextMinute(now: Date): number {
	return 60_000 - (now.getTime() % 60_000);
}
