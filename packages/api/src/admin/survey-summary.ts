import { getSurveySummary } from "@repo/db/queries/surveys";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelQueryFn } from "../auth/panel-middleware";

export type {
	SurveyQuestionSummary,
	SurveySummary,
} from "@repo/db/queries/surveys";

/** The anonymous survey results of an event (F20), for its managers. */
export const fetchSurveySummaryServer = panelQueryFn
	.validator((input: unknown) =>
		z.object({ eventId: z.string().min(1) }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return getSurveySummary(data.eventId);
	});

export const surveySummaryQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "survey-summary"] as const,
		queryFn: () => fetchSurveySummaryServer({ data: { eventId } }),
	});
