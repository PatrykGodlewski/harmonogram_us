import {
	addRegistrantByEmail,
	removeRegistrant,
} from "@repo/db/queries/event-registrations";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";
import { registrationEmailHooks } from "../notifications/registration-hooks";

const addRegistrantSchema = z.object({
	eventId: z.string().min(1),
	email: z.email().max(320),
	/** Language of the e-mails the person gets (the organizer's UI language). */
	locale: z.enum(["pl", "en"]),
});

const removeRegistrantSchema = z.object({
	eventId: z.string().min(1),
	registrationId: z.string().min(1),
});

export const addRegistrantServer = panelActionFn
	.inputValidator((input: unknown) => addRegistrantSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			addRegistrantByEmail(
				data.eventId,
				data.email,
				data.locale,
				registrationEmailHooks,
			),
		);
	});

export const removeRegistrantServer = panelActionFn
	.inputValidator((input: unknown) => removeRegistrantSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			removeRegistrant(
				data.eventId,
				data.registrationId,
				registrationEmailHooks,
			),
		);
	});
