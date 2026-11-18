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
