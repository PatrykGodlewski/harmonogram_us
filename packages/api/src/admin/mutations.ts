import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware";
import {
	createEventSchema,
	createLookupSchema,
	deleteByIdSchema,
	updateEventSchema,
	updateLookupSchema,
} from "./schemas";

const protectedActionFn = createServerFn({ method: "POST" }).middleware([
	authMiddleware,
]);

export const createAdminEventServer = protectedActionFn
	.inputValidator((input: unknown) => createEventSchema.parse(input))
	.handler(async ({ data }) => {
		const { createEvent } = await import("@repo/db/queries/events");
		return createEvent(data);
	});

export const updateAdminEventServer = protectedActionFn
	.inputValidator((input: unknown) => updateEventSchema.parse(input))
	.handler(async ({ data }) => {
		const { updateEvent } = await import("@repo/db/queries/events");
		const event = await updateEvent(data);
		if (!event) {
			throw new Error("NOT_FOUND");
		}
		return event;
	});

export const deleteAdminEventServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const { deleteEvent } = await import("@repo/db/queries/events");
		const event = await deleteEvent(data.id);
		if (!event) {
			throw new Error("NOT_FOUND");
		}
		return event;
	});

export const createAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { createEventType } = await import("@repo/db/queries/lookups");
		return createEventType(data);
	});

export const updateAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { updateEventType } = await import("@repo/db/queries/lookups");
		const row = await updateEventType(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const { deleteEventType } = await import("@repo/db/queries/lookups");
		const row = await deleteEventType(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { createEventLocation } = await import("@repo/db/queries/lookups");
		return createEventLocation(data);
	});

export const updateAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { updateEventLocation } = await import("@repo/db/queries/lookups");
		const row = await updateEventLocation(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const { deleteEventLocation } = await import("@repo/db/queries/lookups");
		const row = await deleteEventLocation(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { createEventFaculty } = await import("@repo/db/queries/lookups");
		return createEventFaculty(data);
	});

export const updateAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const { updateEventFaculty } = await import("@repo/db/queries/lookups");
		const row = await updateEventFaculty(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const { deleteEventFaculty } = await import("@repo/db/queries/lookups");
		const row = await deleteEventFaculty(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});
