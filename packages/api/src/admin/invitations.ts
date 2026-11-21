import { getEventStatus } from "@repo/db/queries/events";
import { enqueueEmails } from "@repo/jobs/client";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { appError } from "../errors";
import { consumeRateLimit } from "../security/rate-limit";
import {
	EVENT_INVITATION_LIMIT,
	eventMessageRateKeys,
} from "../security/rate-limits";
import { MAX_INVITATIONS } from "./invitation-limits";

const sendInvitationsSchema = z.object({
	eventId: z.string().min(1),
	emails: z.array(z.email().max(320)).min(1).max(MAX_INVITATIONS),
	note: z.string().trim().max(2000).optional(),
	/** Language of the e-mails (the organiser's UI language). */
	locale: z.enum(["pl", "en"]),
});

/** E-mails invitations to a published event (with the invite link when it is invite-only). */
export const sendEventInvitationsServer = panelActionFn
	.validator((input: unknown) => sendInvitationsSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		if ((await getEventStatus(data.eventId)) !== "published") {
			throw appError("EVENT_NOT_PUBLISHED");
		}
		for (const key of eventMessageRateKeys(data.eventId, context.user.id)) {
			await consumeRateLimit("event-invitation", EVENT_INVITATION_LIMIT, key);
		}
		const emails = [
			...new Set(data.emails.map((email) => email.toLowerCase())),
		];
		await enqueueEmails(
			emails.map((to) => ({
				kind: "event-invitation" as const,
				to,
				eventId: data.eventId,
				locale: data.locale,
				note: data.note || undefined,
				replyTo: context.user.email,
			})),
		);
		return { sent: emails.length };
	});
