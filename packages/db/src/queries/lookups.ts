import { asc, eq } from "drizzle-orm";
import { db } from "../client";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";

export type LookupRow = {
	id: string;
	slug: string;
	label: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateLookupInput = {
	id?: string;
	slug: string;
	label: string;
	sortOrder?: number;
};

export type UpdateLookupInput = {
	id: string;
	slug?: string;
	label?: string;
	sortOrder?: number;
};

export async function getEventTypes(): Promise<LookupRow[]> {
	return db.select().from(eventTypes).orderBy(asc(eventTypes.sortOrder));
}

export async function createEventType(input: CreateLookupInput) {
	const [row] = await db
		.insert(eventTypes)
		.values({
			...(input.id ? { id: input.id } : {}),
			slug: input.slug,
			label: input.label,
			sortOrder: input.sortOrder ?? 0,
		})
		.returning();
	return row;
}

export async function updateEventType(input: UpdateLookupInput) {
	const { id, ...values } = input;
	const [row] = await db
		.update(eventTypes)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(eventTypes.id, id))
		.returning();
	return row ?? null;
}

export async function deleteEventType(id: string) {
	const [row] = await db
		.delete(eventTypes)
		.where(eq(eventTypes.id, id))
		.returning({ id: eventTypes.id });
	return row ?? null;
}

export async function getEventLocations(): Promise<LookupRow[]> {
	return db
		.select()
		.from(eventLocations)
		.orderBy(asc(eventLocations.sortOrder));
}

export async function createEventLocation(input: CreateLookupInput) {
	const [row] = await db
		.insert(eventLocations)
		.values({
			...(input.id ? { id: input.id } : {}),
			slug: input.slug,
			label: input.label,
			sortOrder: input.sortOrder ?? 0,
		})
		.returning();
	return row;
}

export async function updateEventLocation(input: UpdateLookupInput) {
	const { id, ...values } = input;
	const [row] = await db
		.update(eventLocations)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(eventLocations.id, id))
		.returning();
	return row ?? null;
}

export async function deleteEventLocation(id: string) {
	const [row] = await db
		.delete(eventLocations)
		.where(eq(eventLocations.id, id))
		.returning({ id: eventLocations.id });
	return row ?? null;
}

export async function getEventFaculties(): Promise<LookupRow[]> {
	return db
		.select()
		.from(eventFaculties)
		.orderBy(asc(eventFaculties.sortOrder));
}

export async function createEventFaculty(input: CreateLookupInput) {
	const [row] = await db
		.insert(eventFaculties)
		.values({
			...(input.id ? { id: input.id } : {}),
			slug: input.slug,
			label: input.label,
			sortOrder: input.sortOrder ?? 0,
		})
		.returning();
	return row;
}

export async function updateEventFaculty(input: UpdateLookupInput) {
	const { id, ...values } = input;
	const [row] = await db
		.update(eventFaculties)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(eventFaculties.id, id))
		.returning();
	return row ?? null;
}

export async function deleteEventFaculty(id: string) {
	const [row] = await db
		.delete(eventFaculties)
		.where(eq(eventFaculties.id, id))
		.returning({ id: eventFaculties.id });
	return row ?? null;
}
