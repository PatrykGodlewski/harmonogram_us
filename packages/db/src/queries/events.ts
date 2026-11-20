import { and, asc, desc, eq, ilike, max } from "drizzle-orm";
import { db } from "../client";
import { agendaItems } from "../schema/agenda";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import { eventOrganizers } from "../schema/event-organizers";
import { eventSeatCounts } from "../schema/event-registrations";
import { events } from "../schema/events";
import { type AgendaItem, listAgendaItems } from "./agenda-items";
import {
	CAPACITY_EDIT_ERRORS,
	DomainError,
	mapConstraintError,
} from "./domain-errors";
import {
	getEffectiveEventEnd,
	promoteAndNotify,
	type RegistrationHooks,
} from "./event-registrations";
import { lockEvent } from "./locks";

export type EventFilters = {
	search?: string;
	sortOrder?: "asc" | "desc";
	locationFilter?: string;
	facultyFilter?: string;
	eventTypeFilter?: string;
};

export type EventWithRelations = {
	id: string;
	title: string;
	description: string | null;
	date: Date;
	endsAt: Date | null;
	maxSeats: number;
	groupDeadlineHours: number;
	seatsRemaining: number;
	typeId: string;
	locationId: string | null;
	facultyId: string | null;
	createdAt: Date;
	updatedAt: Date;
	typeLabel: string;
	typeSlug: string;
	locationLabel: string | null;
	locationSlug: string | null;
	facultyLabel: string | null;
	facultySlug: string | null;
};

export type FilterOption = {
	id: string;
	slug: string;
	label: string;
};

export type EventFilterOptions = {
	types: FilterOption[];
	locations: FilterOption[];
	faculties: FilterOption[];
};

export async function getEventFilterOptions(): Promise<EventFilterOptions> {
	const [types, locations, faculties] = await Promise.all([
		db
			.select({
				id: eventTypes.id,
				slug: eventTypes.slug,
				label: eventTypes.label,
			})
			.from(eventTypes)
			.orderBy(asc(eventTypes.sortOrder)),
		db
			.select({
				id: eventLocations.id,
				slug: eventLocations.slug,
				label: eventLocations.label,
			})
			.from(eventLocations)
			.orderBy(asc(eventLocations.sortOrder)),
		db
			.select({
				id: eventFaculties.id,
				slug: eventFaculties.slug,
				label: eventFaculties.label,
			})
			.from(eventFaculties)
			.orderBy(asc(eventFaculties.sortOrder)),
	]);

	return { types, locations, faculties };
}

export async function getEvents(
	filters?: EventFilters,
): Promise<EventWithRelations[]> {
	return queryEvents(filters);
}

export type EventPage = { events: EventWithRelations[]; hasMore: boolean };

/** The first `limit` events matching the filters, and whether there are more (the public list). */
export async function getEventPage(
	filters: EventFilters,
	limit: number,
): Promise<EventPage> {
	const rows = await queryEvents(filters, undefined, limit + 1);
	return { events: rows.slice(0, limit), hasMore: rows.length > limit };
}

async function queryEvents(
	filters?: EventFilters,
	eventId?: string,
	limit?: number,
): Promise<EventWithRelations[]> {
	const conditions = [];

	if (eventId) {
		conditions.push(eq(events.id, eventId));
	}

	if (filters?.search) {
		conditions.push(ilike(events.title, `%${filters.search}%`));
	}

	if (filters?.locationFilter && filters.locationFilter !== "all") {
		conditions.push(eq(eventLocations.slug, filters.locationFilter));
	}

	if (filters?.facultyFilter && filters.facultyFilter !== "all") {
		conditions.push(eq(eventFaculties.slug, filters.facultyFilter));
	}

	if (filters?.eventTypeFilter && filters.eventTypeFilter !== "all") {
		conditions.push(eq(eventTypes.slug, filters.eventTypeFilter));
	}

	// The id breaks ties, so pages stay stable for events at the same time.
	const order =
		filters?.sortOrder === "asc"
			? [asc(events.date), asc(events.id)]
			: [desc(events.date), desc(events.id)];

	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			description: events.description,
			date: events.date,
			endsAt: events.endsAt,
			groupDeadlineHours: events.groupDeadlineHours,
			maxSeats: events.maxSeats,
			seatsRemainingFromCounts: eventSeatCounts.seatsRemaining,
			typeId: events.typeId,
			locationId: events.locationId,
			facultyId: events.facultyId,
			createdAt: events.createdAt,
			updatedAt: events.updatedAt,
			typeLabel: eventTypes.label,
			typeSlug: eventTypes.slug,
			locationLabel: eventLocations.label,
			locationSlug: eventLocations.slug,
			facultyLabel: eventFaculties.label,
			facultySlug: eventFaculties.slug,
		})
		.from(events)
		.innerJoin(eventTypes, eq(events.typeId, eventTypes.id))
		.leftJoin(eventLocations, eq(events.locationId, eventLocations.id))
		.leftJoin(eventFaculties, eq(events.facultyId, eventFaculties.id))
		.leftJoin(eventSeatCounts, eq(events.id, eventSeatCounts.eventId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(...order)
		.limit(limit ?? Number.MAX_SAFE_INTEGER);

	return rows.map(({ seatsRemainingFromCounts, ...row }) => ({
		...row,
		seatsRemaining: seatsRemainingFromCounts ?? row.maxSeats,
	}));
}

export type CreateEventInput = {
	id?: string;
	groupDeadlineHours?: number;
	title: string;
	description?: string | null;
	date: Date;
	endsAt?: Date | null;
	maxSeats: number;
	typeId: string;
	locationId?: string | null;
	facultyId?: string | null;
	/** Becomes the event's first organizer; null for events only admins manage (seed data). */
	organizerId: string | null;
};

export async function createEvent(input: CreateEventInput) {
	return db.transaction(async (tx) => {
		const [event] = await tx
			.insert(events)
			.values({
				...(input.id ? { id: input.id } : {}),
				title: input.title,
				description: input.description ?? null,
				date: input.date,
				endsAt: input.endsAt ?? null,
				...(input.groupDeadlineHours !== undefined
					? { groupDeadlineHours: input.groupDeadlineHours }
					: {}),
				maxSeats: input.maxSeats,
				typeId: input.typeId,
				locationId: input.locationId ?? null,
				facultyId: input.facultyId ?? null,
			})
			.returning();
		if (event && input.organizerId) {
			await tx
				.insert(eventOrganizers)
				.values({ eventId: event.id, userId: input.organizerId });
		}
		return event;
	});
}

export type UpdateEventInput = {
	id: string;
	groupDeadlineHours?: number;
	title?: string;
	description?: string | null;
	date?: Date;
	endsAt?: Date | null;
	maxSeats?: number;
	typeId?: string;
	locationId?: string | null;
	facultyId?: string | null;
};

/** Updates an event; raising the limit promotes waitlisted people into the new places. */
export async function updateEvent(
	input: UpdateEventInput,
	hooks?: RegistrationHooks,
) {
	const { id, ...values } = input;
	try {
		return await db.transaction(async (tx) => {
			await lockEvent(tx, id);
			if (values.maxSeats !== undefined) {
				const [largest] = await tx
					.select({ maxSeats: max(agendaItems.maxSeats) })
					.from(agendaItems)
					.where(eq(agendaItems.eventId, id));
				if (largest?.maxSeats != null && largest.maxSeats > values.maxSeats) {
					throw new DomainError("ITEM_LIMIT_ABOVE_EVENT");
				}
			}
			const [event] = await tx
				.update(events)
				.set({ ...values, updatedAt: new Date() })
				.where(eq(events.id, id))
				.returning();
			if (event && values.maxSeats !== undefined) {
				await promoteAndNotify(tx, id, hooks);
			}
			return event ?? null;
		});
	} catch (error) {
		mapConstraintError(error, CAPACITY_EDIT_ERRORS);
	}
}

export async function deleteEvent(id: string) {
	const [event] = await db
		.delete(events)
		.where(eq(events.id, id))
		.returning({ id: events.id });
	return event ?? null;
}

export type EventDetails = EventWithRelations & {
	effectiveEndsAt: Date;
	agenda: AgendaItem[];
};

export async function getEventById(id: string): Promise<EventDetails | null> {
	const [[event], agenda, effectiveEndsAt] = await Promise.all([
		queryEvents(undefined, id),
		listAgendaItems(id),
		getEffectiveEventEnd(db, id),
	]);
	if (!event) {
		return null;
	}
	return {
		...event,
		agenda,
		effectiveEndsAt:
			effectiveEndsAt ?? new Date(event.date.getTime() + 86_400_000),
	};
}
