import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { db } from "../client";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import { eventSeatCounts } from "../schema/event-registrations";
import { events } from "../schema/events";

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
	date: Date;
	maxSeats: number;
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
	const conditions = [];

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

	const order =
		filters?.sortOrder === "asc" ? asc(events.date) : desc(events.date);

	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			date: events.date,
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
		.orderBy(order);

	return rows.map(({ seatsRemainingFromCounts, ...row }) => ({
		...row,
		seatsRemaining: seatsRemainingFromCounts ?? row.maxSeats,
	}));
}

export type CreateEventInput = {
	id?: string;
	title: string;
	date: Date;
	maxSeats: number;
	typeId: string;
	locationId?: string | null;
	facultyId?: string | null;
};

export async function createEvent(input: CreateEventInput) {
	const [event] = await db
		.insert(events)
		.values({
			...(input.id ? { id: input.id } : {}),
			title: input.title,
			date: input.date,
			maxSeats: input.maxSeats,
			typeId: input.typeId,
			locationId: input.locationId ?? null,
			facultyId: input.facultyId ?? null,
		})
		.returning();
	return event;
}

export type UpdateEventInput = {
	id: string;
	title?: string;
	date?: Date;
	maxSeats?: number;
	typeId?: string;
	locationId?: string | null;
	facultyId?: string | null;
};

export async function updateEvent(input: UpdateEventInput) {
	const { id, ...values } = input;
	const [event] = await db
		.update(events)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(events.id, id))
		.returning();
	return event ?? null;
}

export async function deleteEvent(id: string) {
	const [event] = await db
		.delete(events)
		.where(eq(events.id, id))
		.returning({ id: events.id });
	return event ?? null;
}
