import {
	createEventQuestion,
	deleteEventQuestion,
	listEventQuestions,
	moveEventQuestion,
	updateEventQuestion,
} from "@repo/db/queries/event-questions";
import { queryOptions } from "@tanstack/react-query";

export type { EventQuestion } from "@repo/db/queries/event-questions";

import { z } from "zod";
import {
	assertCanManageEvent,
	assertCanManageQuestion,
} from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";

const questionFields = {
	label: z.string().trim().min(1).max(300),
	kind: z.enum(["text", "choice", "yesno"]),
	options: z.array(z.string().trim().max(200)).max(30).optional(),
	required: z.boolean().optional(),
};

const eventIdSchema = z.object({ eventId: z.string().min(1) });
const questionIdSchema = z.object({ id: z.string().min(1) });

export const fetchEventQuestionsServer = panelQueryFn
	.validator((input: unknown) => eventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return listEventQuestions(data.eventId);
	});

export const eventQuestionsQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "questions"] as const,
		queryFn: () => fetchEventQuestionsServer({ data: { eventId } }),
	});

export const createEventQuestionServer = panelActionFn
	.validator((input: unknown) =>
		eventIdSchema.extend(questionFields).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() => createEventQuestion(data));
	});

export const updateEventQuestionServer = panelActionFn
	.validator((input: unknown) =>
		questionIdSchema
			.extend(questionFields)
			.partial({ label: true, kind: true })
			.parse(input),
	)
	.handler(async ({ data: { id, ...fields }, context }) => {
		await assertCanManageQuestion(context.user, id);
		return withDomainErrors(() => updateEventQuestion(id, fields));
	});

export const deleteEventQuestionServer = panelActionFn
	.validator((input: unknown) => questionIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageQuestion(context.user, data.id);
		await deleteEventQuestion(data.id);
	});

export const moveEventQuestionServer = panelActionFn
	.validator((input: unknown) =>
		questionIdSchema.extend({ direction: z.enum(["up", "down"]) }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageQuestion(context.user, data.id);
		await withDomainErrors(() => moveEventQuestion(data.id, data.direction));
	});
