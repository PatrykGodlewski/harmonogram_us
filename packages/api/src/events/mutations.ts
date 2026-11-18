import { DomainError } from "@repo/db/queries/domain-errors";
import {
	registerForAgendaItem,
	registerForEvent,
	unregisterFromAgendaItem,
	unregisterFromEvent,
} from "@repo/db/queries/event-registrations";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCurrentSession } from "../auth/user";
import { withDomainErrors } from "../errors";
import { agendaItemIdSchema } from "./schemas";

export const registerForEventInputSchema = z.object({
	eventId: z.string().min(1),
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
			throw new Error("UNAUTHORIZED");
		}

		try {
			return await registerForEvent(data.eventId, session.user.id);
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
			throw new Error("UNAUTHORIZED");
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

async function requireUserId(): Promise<string> {
	const session = await getCurrentSession();
	if (!session?.user) {
		throw new Error("UNAUTHORIZED");
	}
	return session.user.id;
}

export const registerForAgendaItemServer = createServerFn({ method: "POST" })
	.inputValidator(agendaItemIdSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		return withDomainErrors(() =>
			registerForAgendaItem(data.agendaItemId, userId),
		);
	});

export const unregisterFromAgendaItemServer = createServerFn({ method: "POST" })
	.inputValidator(agendaItemIdSchema)
	.handler(async ({ data }) => {
		const userId = await requireUserId();
		return withDomainErrors(() =>
			unregisterFromAgendaItem(data.agendaItemId, userId),
		);
	});
