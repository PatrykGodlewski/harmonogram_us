import {
	createAgendaItem,
	deleteAgendaItem,
	updateAgendaItem,
} from "@repo/db/queries/agenda-items";
import { duplicateEvent } from "@repo/db/queries/event-duplicate";
import {
	cancelEvent,
	createEvent,
	deleteEvent,
	publishEvent,
	updateEvent,
} from "@repo/db/queries/events";
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
import { z } from "zod";
import { adminMiddleware } from "../auth/admin-middleware";
import {
	assertCanCreateEvents,
	assertCanDeleteEvent,
	assertCanManageAgendaItem,
	assertCanManageEvent,
} from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { appError, withDomainErrors } from "../errors";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import {
	createAgendaItemSchema,
	createEventSchema,
	createLookupSchema,
	deleteByIdSchema,
	eventIdActionSchema,
	updateAgendaItemSchema,
	updateEventSchema,
	updateLookupSchema,
} from "./schemas";

const adminActionFn = createServerFn({ method: "POST" }).middleware([
	adminMiddleware,
]);

export const createAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => createEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCreateEvents(context.user);
		return createEvent({ ...data, organizerId: context.user.id });
	});

export const updateAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => updateEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		const event = await withDomainErrors(() =>
			updateEvent(data, registrationEmailHooks),
		);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const deleteAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanDeleteEvent(context.user, data.id);
		const event = await deleteEvent(data.id);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const publishAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		return withDomainErrors(() => publishEvent(data.id));
	});

export const cancelAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		return withDomainErrors(() => cancelEvent(data.id, registrationEmailHooks));
	});

const duplicateEventSchema = z.object({
	id: z.string().min(1),
	date: z.coerce.date(),
});

export const duplicateAdminEventServer = panelActionFn
	.inputValidator((input: unknown) => duplicateEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		await assertCanCreateEvents(context.user);
		return withDomainErrors(() =>
			duplicateEvent({
				eventId: data.id,
				date: data.date,
				actorId: context.user.id,
			}),
		);
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

export const createAdminAgendaItemServer = panelActionFn
	.inputValidator((input: unknown) => createAgendaItemSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() => createAgendaItem(data));
	});

export const updateAdminAgendaItemServer = panelActionFn
	.inputValidator((input: unknown) => updateAgendaItemSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaItem(context.user, data.id);
		const { id, ...values } = data;
		const item = await withDomainErrors(() => updateAgendaItem(id, values));
		if (!item) {
			throw appError("NOT_FOUND");
		}
		return item;
	});

export const deleteAdminAgendaItemServer = panelActionFn
	.inputValidator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaItem(context.user, data.id);
		const item = await deleteAgendaItem(data.id);
		if (!item) {
			throw appError("NOT_FOUND");
		}
		return item;
	});
