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
import { agendaItemIdSchema } from "./schemas";

export const registerForEventInputSchema = z.object({
	eventId: z.string().min(1),
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
	.inputValidator(registerForEventInputSchema)
	.handler(async ({ data }) => {
		const session = await getCurrentSession();
		if (!session?.user) {
			throw appError("UNAUTHORIZED");
		}

		try {
			return await registerForEvent(data.eventId, session.user.id, data.locale);
		} catch (error) {
			if (error instanceof DomainError) {
				throw new Error(error.code);
			}
			throw error;
		}
	});

export const unregisterFromEventServer = createServerFn({ method: "POST" })
	.inputValidator(unregisterFromEventInputSchema)
	.handler(async ({ data }) => {
		const session = await getCurrentSession();
		if (!session?.user) {
			throw appError("UNAUTHORIZED");
		}

		try {
			return await unregisterFromEvent(data.eventId, session.user.id);
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
	.inputValidator(agendaItemIdSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			registerForAgendaItem(data.agendaItemId, context.user.id),
		),
	);

export const unregisterFromAgendaItemServer = protectedActionFn
	.inputValidator(agendaItemIdSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			unregisterFromAgendaItem(data.agendaItemId, context.user.id),
		),
	);
