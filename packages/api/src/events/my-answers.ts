import {
	getMyAnswers,
	updateRegistrationAnswers,
} from "@repo/db/queries/event-registrations";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { appError, withDomainErrors } from "../errors";
import { protectedActionFn } from "../procedures";
import { answersSchema } from "./schemas";

const eventIdSchema = z.object({ eventId: z.string().min(1) });

export const fetchMyAnswersServer = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.inputValidator((input: unknown) => eventIdSchema.parse(input))
	.handler(async ({ data, context }) =>
		getMyAnswers(data.eventId, context.user.id),
	);

/** Under ["my-registrations"], so registering or withdrawing refreshes it. */
export const myAnswersQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["my-registrations", "answers", eventId] as const,
		queryFn: () => fetchMyAnswersServer({ data: { eventId } }),
	});

/** The signed-in person changes their answers while the event is open. */
export const updateMyAnswersServer = protectedActionFn
	.inputValidator((input: unknown) =>
		eventIdSchema.extend({ answers: answersSchema }).parse(input),
	)
	.handler(async ({ data, context }) => {
		const mine = await getMyAnswers(data.eventId, context.user.id);
		if (!mine) {
			throw appError("NOT_REGISTERED");
		}
		await withDomainErrors(() =>
			updateRegistrationAnswers(
				data.eventId,
				mine.registrationId,
				data.answers,
				{
					byOrganizer: false,
				},
			),
		);
	});
