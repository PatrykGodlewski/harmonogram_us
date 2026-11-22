import { setCheckedInMany } from "@repo/db/queries/check-in";
import {
	addRegistrantByEmail,
	removeRegistrant,
	removeRegistrants,
	updateRegistrationAnswers,
} from "@repo/db/queries/event-registrations";
import {
	approveRegistrations,
	rejectRegistrations,
} from "@repo/db/queries/registration-approval";
import { z } from "zod";
import { assertCanCheckIn, assertCanManageEvent } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";
import { answersSchema } from "../events/schemas";
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
	.validator((input: unknown) => addRegistrantSchema.parse(input))
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
	.validator((input: unknown) => removeRegistrantSchema.parse(input))
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

/** Many registrations of one event, picked on the list. */
const bulkSchema = z.object({
	eventId: z.string().min(1),
	registrationIds: z.array(z.string().min(1)).min(1).max(1000),
});

export const removeRegistrantsServer = panelActionFn
	.validator((input: unknown) => bulkSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			removeRegistrants(
				data.eventId,
				data.registrationIds,
				registrationEmailHooks,
			),
		);
	});

export const setCheckedInManyServer = panelActionFn
	.validator((input: unknown) =>
		bulkSchema.extend({ checkedIn: z.boolean() }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanCheckIn(context.user, data.eventId);
		return withDomainErrors(() =>
			setCheckedInMany(data.eventId, data.registrationIds, data.checkedIn),
		);
	});

/** Approves requests: free places first, then the waitlist (oldest request first). */
export const approveRegistrationsServer = panelActionFn
	.validator((input: unknown) => bulkSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			approveRegistrations(
				data.eventId,
				data.registrationIds,
				registrationEmailHooks,
			),
		);
	});

export const rejectRegistrationsServer = panelActionFn
	.validator((input: unknown) => bulkSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			rejectRegistrations(
				data.eventId,
				data.registrationIds,
				registrationEmailHooks,
			),
		);
	});

/** An organiser corrects someone's answers (any time; required ones may stay empty). */
export const updateRegistrantAnswersServer = panelActionFn
	.validator((input: unknown) =>
		removeRegistrantSchema.extend({ answers: answersSchema }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			updateRegistrationAnswers(
				data.eventId,
				data.registrationId,
				data.answers,
				{
					byOrganizer: true,
				},
			),
		);
	});
