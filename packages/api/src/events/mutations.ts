import { getAgendaItemEventId } from "@repo/db/queries/agenda-items";
import { DomainError } from "@repo/db/queries/domain-errors";
import {
	registerForAgendaItem,
	registerForEvent,
	unregisterFromAgendaItem,
	unregisterFromEvent,
} from "@repo/db/queries/event-registrations";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { getCurrentSession } from "../auth/user";
import { appError, withDomainErrors } from "../errors";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import { canOpenEvent } from "./access";
import { agendaItemIdSchema, answersSchema, inviteSchema } from "./schemas";

/** `locale` is the UI language for the confirmation e-mail (server functions have no locale prefix). */
const registerForAgendaItemSchema = agendaItemIdSchema.extend({
	locale: z.enum(["pl", "en"]),
	invite: inviteSchema,
});

export const registerForEventInputSchema = z.object({
	eventId: z.string().min(1),
	invite: inviteSchema,
	/** Answers to the event's questions, by question id (checked against them on the server). */
	answers: answersSchema.optional(),
	/** UI language, for the registrant's e-mails (server functions have no locale prefix). */
	locale: z.enum(["pl", "en"]),
});

export type RegisterForEventInput = z.infer<typeof registerForEventInputSchema>;

export const unregisterFromEventInputSchema = z.object({
	eventId: z.string().min(1),
});

export type UnregisterFromEventInput = z.infer<
	typeof unregisterFromEventInputSchema
>;

export const registerForEventServer = createServerFn({ method: "POST" })
	.validator(registerForEventInputSchema)
	.handler(async ({ data }) => {
		const session = await getCurrentSession();
		if (!session?.user) {
			throw appError("UNAUTHORIZED");
		}
		if (!(await canOpenEvent(data.eventId, session.user.id, data.invite))) {
			throw appError("EVENT_NOT_FOUND");
		}

		try {
			return await registerForEvent(
				data.eventId,
				session.user.id,
				data.locale,
				registrationEmailHooks,
				{ answers: data.answers },
			);
		} catch (error) {
			if (error instanceof DomainError) {
				throw new Error(error.code);
			}
			throw error;
		}
	});

export const unregisterFromEventServer = createServerFn({ method: "POST" })
	.validator(unregisterFromEventInputSchema)
	.handler(async ({ data }) => {
		const session = await getCurrentSession();
		if (!session?.user) {
			throw appError("UNAUTHORIZED");
		}

		try {
			return await unregisterFromEvent(
				data.eventId,
				session.user.id,
				registrationEmailHooks,
			);
		} catch (error) {
			if (error instanceof DomainError) {
				throw new Error(error.code);
			}
			throw error;
		}
	});

const protectedActionFn = createServerFn({ method: "POST" }).middleware([
	authMiddleware,
]);

export const registerForAgendaItemServer = protectedActionFn
	.validator(registerForAgendaItemSchema)
	.handler(async ({ data, context }) => {
		const eventId = await getAgendaItemEventId(data.agendaItemId);
		if (
			!eventId ||
			!(await canOpenEvent(eventId, context.user.id, data.invite))
		) {
			throw appError("ITEM_NOT_FOUND");
		}
		return withDomainErrors(() =>
			registerForAgendaItem(
				data.agendaItemId,
				context.user.id,
				data.locale,
				registrationEmailHooks,
			),
		);
	});

export const unregisterFromAgendaItemServer = protectedActionFn
	.validator(agendaItemIdSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			unregisterFromAgendaItem(data.agendaItemId, context.user.id),
		),
	);
