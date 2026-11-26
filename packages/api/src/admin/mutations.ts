import { eventImageHooks } from "@repo/api/event-images/queue";
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
	regenerateInviteToken,
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
	.validator((input: unknown) => createEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCreateEvents(context.user);
		return createEvent(
			{ ...data, organizerId: context.user.id },
			eventImageHooks(),
		);
	});

export const updateAdminEventServer = panelActionFn
	.validator((input: unknown) => updateEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		const event = await withDomainErrors(() =>
			updateEvent(data, registrationEmailHooks, eventImageHooks()),
		);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const deleteAdminEventServer = panelActionFn
	.validator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanDeleteEvent(context.user, data.id);
		const event = await deleteEvent(data.id);
		if (!event) {
			throw appError("NOT_FOUND");
		}
		return event;
	});

export const publishAdminEventServer = panelActionFn
	.validator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		return withDomainErrors(() => publishEvent(data.id));
	});

export const cancelAdminEventServer = panelActionFn
	.validator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		return withDomainErrors(() => cancelEvent(data.id, registrationEmailHooks));
	});

const duplicateEventSchema = z.object({
	id: z.string().min(1),
	date: z.coerce.date(),
	repeat: z.enum(["once", "weekly", "monthly"]).optional(),
	count: z.number().int().min(1).max(12).optional(),
	copy: z.object({ agenda: z.boolean(), organizers: z.boolean() }).optional(),
});

export const duplicateAdminEventServer = panelActionFn
	.validator((input: unknown) => duplicateEventSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		await assertCanCreateEvents(context.user);
		return withDomainErrors(() =>
			duplicateEvent({
				eventId: data.id,
				date: data.date,
				repeat: data.repeat,
				count: data.count,
				copy: data.copy,
				actorId: context.user.id,
			}),
		);
	});

export const createAdminEventTypeServer = adminActionFn
	.validator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventType(data));

export const updateAdminEventTypeServer = adminActionFn
	.validator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventType(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventTypeServer = adminActionFn
	.validator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventType(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventLocationServer = adminActionFn
	.validator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventLocation(data));

export const updateAdminEventLocationServer = adminActionFn
	.validator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventLocation(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventLocationServer = adminActionFn
	.validator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventLocation(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminEventFacultyServer = adminActionFn
	.validator((input: unknown) => createLookupSchema.parse(input))
	.handler(async ({ data }) => createEventFaculty(data));

export const updateAdminEventFacultyServer = adminActionFn
	.validator((input: unknown) => updateLookupSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await updateEventFaculty(data);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const deleteAdminEventFacultyServer = adminActionFn
	.validator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data }) => {
		const row = await deleteEventFaculty(data.id);
		if (!row) {
			throw appError("NOT_FOUND");
		}
		return row;
	});

export const createAdminAgendaItemServer = panelActionFn
	.validator((input: unknown) => createAgendaItemSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() => createAgendaItem(data));
	});

export const updateAdminAgendaItemServer = panelActionFn
	.validator((input: unknown) => updateAgendaItemSchema.parse(input))
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
	.validator((input: unknown) => deleteByIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaItem(context.user, data.id);
		const item = await deleteAgendaItem(data.id);
		if (!item) {
			throw appError("NOT_FOUND");
		}
		return item;
	});

/** A new invite link for an invite-only event; the old one stops working. */
export const regenerateInviteServer = panelActionFn
	.validator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		return withDomainErrors(() => regenerateInviteToken(data.id));
	});
