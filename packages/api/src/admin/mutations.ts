import { createEvent, deleteEvent, updateEvent } from "@repo/db/queries/events";
import {
	createEventFaculty,
	createEventLocation,
	createEventType,
	deleteEventFaculty,
	deleteEventLocation,
	deleteEventType,
	updateEventFaculty,
	updateEventLocation,
	updateEventType,
} from "@repo/db/queries/lookups";
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
	.handler(async ({ data }) => createEvent(data));

export const updateAdminEventServer = protectedActionFn
	.inputValidator((input: unknown) => updateEventSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await updateEvent(data);
		if (!event) {
			throw new Error("NOT_FOUND");
		}
		return event;
	});

export const deleteAdminEventServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await deleteEvent(data.id);
		if (!event) {
			throw new Error("NOT_FOUND");
		}
		return event;
	});

export const createAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventType(data));

export const updateAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventType(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventTypeServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventType(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventLocation(data));

export const updateAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventLocation(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventLocationServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventLocation(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventFaculty(data));

export const updateAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventFaculty(data);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventFacultyServer = protectedActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventFaculty(data.id);
		if (!row) {
			throw new Error("NOT_FOUND");
		}
		return row;
	});
