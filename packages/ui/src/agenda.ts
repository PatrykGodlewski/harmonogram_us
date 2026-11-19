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
