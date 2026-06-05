import {
	EventRegistrationError,
	registerForEvent,
	unregisterFromEvent,
} from "@repo/db/queries/event-registrations";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getCurrentSession } from "../auth/user";

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
			if (error instanceof EventRegistrationError) {
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
			if (error instanceof EventRegistrationError) {
				throw new Error(error.code);
			}
			throw error;
		}
	});
