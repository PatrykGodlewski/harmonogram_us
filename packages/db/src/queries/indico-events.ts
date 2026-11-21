import { and, asc, desc, gte, ilike, notInArray, sql } from "drizzle-orm";
import { db } from "../client";
import { indicoEvents } from "../schema/indico-events";
import { type WhenFilter, whenFilterConditions } from "./events";

/** One event read from the university's Indico (F16). */
export type ImportedEvent = {
	id: string;
	title: string;
	startsAt: Date;
	endsAt: Date | null;
	location: string | null;
	room: string | null;
	url: string;
};

export type IndicoListFilters = {
	search?: string;
	whenFilter?: WhenFilter;
	sortOrder?: "asc" | "desc";
};

/** How many events the calendar feed carries at most (as for local events). */
const FEED_LIMIT = 500;

const columns = {
	id: indicoEvents.id,
	title: indicoEvents.title,
	startsAt: indicoEvents.startsAt,
	endsAt: indicoEvents.endsAt,
	location: indicoEvents.location,
	room: indicoEvents.room,
	url: indicoEvents.url,
};

/** Makes the mirror exactly the latest import: changed rows updated, missing ones removed. */
export async function replaceIndicoEvents(
	imported: ImportedEvent[],
): Promise<void> {
	await db.transaction(async (tx) => {
		const ids = imported.map((event) => event.id);
		await tx
			.delete(indicoEvents)
			.where(ids.length > 0 ? notInArray(indicoEvents.id, ids) : undefined);
		if (imported.length === 0) {
			return;
		}
		await tx
			.insert(indicoEvents)
			.values(imported)
			.onConflictDoUpdate({
				target: indicoEvents.id,
				set: {
					title: sql`excluded.title`,
					startsAt: sql`excluded.starts_at`,
					endsAt: sql`excluded.ends_at`,
					location: sql`excluded.location`,
					room: sql`excluded.room`,
					url: sql`excluded.url`,
				},
			});
	});
}

/** The first `limit` imported events matching the public list's search and date filter. */
export async function listIndicoEvents(
	filters: IndicoListFilters,
	limit: number,
): Promise<ImportedEvent[]> {
	const conditions = [
		...(filters.search
			? [ilike(indicoEvents.title, `%${filters.search}%`)]
			: []),
		...whenFilterConditions(indicoEvents.startsAt, filters.whenFilter ?? "all"),
	];
	// The id breaks ties, as in the local list.
	const order =
		filters.sortOrder === "asc"
			? [asc(indicoEvents.startsAt), asc(indicoEvents.id)]
			: [desc(indicoEvents.startsAt), desc(indicoEvents.id)];
	return db
		.select(columns)
		.from(indicoEvents)
		.where(and(...conditions))
		.orderBy(...order)
		.limit(limit);
}

/** Imported events that haven't ended (no end: a day after the start), for the campus feed. */
export async function listIndicoCalendarEntries(
	now: Date,
): Promise<ImportedEvent[]> {
	return db
		.select(columns)
		.from(indicoEvents)
		.where(
			gte(
				sql`coalesce(${indicoEvents.endsAt}, ${indicoEvents.startsAt} + interval '1 day')`,
				now.toISOString(),
			),
		)
		.orderBy(asc(indicoEvents.startsAt), asc(indicoEvents.id))
		.limit(FEED_LIMIT);
}
