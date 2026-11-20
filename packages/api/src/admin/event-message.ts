import { messageRegistrants } from "@repo/db/queries/event-message";
import { enqueueEmails } from "@repo/jobs/client";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { consumeRateLimit } from "../security/rate-limit";
import {
	EVENT_MESSAGE_LIMIT,
	eventMessageRateKeys,
} from "../security/rate-limits";

const sendEventMessageSchema = z.object({
	eventId: z.string().min(1),
	audience: z.enum(["registered", "waitlisted", "all"]),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(5000),
});

/** E-mails the event's registrants; replies go to the organizer who sent it. */
export const sendEventMessageServer = panelActionFn
	.inputValidator((input: unknown) => sendEventMessageSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		for (const key of eventMessageRateKeys(data.eventId, context.user.id)) {
			await consumeRateLimit("event-message", EVENT_MESSAGE_LIMIT, key);
		}
		return messageRegistrants(data.eventId, data.audience, (tx, ids) =>
			enqueueEmails(
				ids.map((registrationId) => ({
					kind: "event-message",
					registrationId,
					subject: data.subject,
					body: data.body,
					replyTo: context.user.email,
				})),
				{ tx },
			),
		);
	});
