import type { EventFiltersParams } from "./schemas";

export type Listed<Local, Indico> =
	| (Local & { source: "local" })
	| (Indico & { source: "indico" });

/**
 * The first `limit` events of both sources in the list's date order. Pass each
 * source's first `limit + 1` rows, so `hasMore` is true when either has more.
 */
export function mergeByDate<
	Local extends { date: Date },
	Indico extends { startsAt: Date },
>(
	local: Local[],
	indico: Indico[],
	sortOrder: "asc" | "desc",
	limit: number,
): { events: Listed<Local, Indico>[]; hasMore: boolean } {
	const time = (event: Listed<Local, Indico>) =>
		(event.source === "local" ? event.date : event.startsAt).getTime();
	const direction = sortOrder === "asc" ? 1 : -1;
	// A stable sort keeps each source's own order (and local events first on ties).
	const merged = [
		...local.map((event) => ({ ...event, source: "local" as const })),
		...indico.map((event) => ({ ...event, source: "indico" as const })),
	].sort((a, b) => direction * (time(a) - time(b)));
	return { events: merged.slice(0, limit), hasMore: merged.length > limit };
}

type ListFilters = Pick<
	EventFiltersParams,
	"eventTypeFilter" | "locationFilter" | "facultyFilter" | "modeFilter"
>;

/** Indico events carry no type, place, unit or format, so picking one leaves them out. */
export function includeIndico(filters: ListFilters): boolean {
	return [
		filters.eventTypeFilter,
		filters.locationFilter,
		filters.facultyFilter,
		filters.modeFilter,
	].every((value) => value === undefined || value === "all");
}
