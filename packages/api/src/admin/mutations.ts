import {
	createAgendaItem,
	deleteAgendaItem,
	updateAgendaItem,
} from "@repo/db/queries/agenda-items";
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
import { adminMiddleware } from "../auth/admin-middleware";
import { appError, withDomainErrors } from "../errors";
import {
	createAgendaItemSchema,
	createEventSchema,
	createLookupSchema,
	deleteByIdSchema,
	updateAgendaItemSchema,
	updateEventSchema,
	updateLookupSchema,
} from "./schemas";

const adminActionFn = createServerFn({ method: "POST" }).middleware([
	adminMiddleware,
]);

export const createAdminEventServer = adminActionFn
	.inputValidator((input: unknown) => createEventSchema.parse(input))
	.handler(async ({ data }) => createEvent(data));

export const updateAdminEventServer = adminActionFn
	.inputValidator((input: unknown) => updateEventSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await withDomainErrors(() => updateEvent(data));
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const deleteAdminEventServer = adminActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const event = await deleteEvent(data.id);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const createAdminEventTypeServer = adminActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventType(data));

export const updateAdminEventTypeServer = adminActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventType(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventTypeServer = adminActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventType(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventLocationServer = adminActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventLocation(data));

export const updateAdminEventLocationServer = adminActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventLocation(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventLocationServer = adminActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventLocation(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventFacultyServer = adminActionFn
	.inputValidator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventFaculty(data));

export const updateAdminEventFacultyServer = adminActionFn
	.inputValidator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventFaculty(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventFacultyServer = adminActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventFaculty(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminAgendaItemServer = adminActionFn
	.inputValidator((input: unknown) => createAgendaItemSchema.parse(input))
	.handler(async ({ data }) => withDomainErrors(() => createAgendaItem(data)));

export const updateAdminAgendaItemServer = adminActionFn
	.inputValidator((input: unknown) => updateAgendaItemSchema.parse(input))
	.handler(async ({ data }) => {
		const { id, ...values } = data;
		const item = await withDomainErrors(() => updateAgendaItem(id, values));
		if (!item) {
			throw appError("NOT_FOUND");
		}
		return item;
	});

export const deleteAdminAgendaItemServer = adminActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const item = await deleteAgendaItem(data.id);
		if (!item) {
			throw appError("NOT_FOUND");
		}
		return item;
	});
