import {
	listUpcomingPublicEvents,
	type PublicEvent,
} from "@repo/db/queries/public-events";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** What the embeddable widget shows (F24); bad values fall back to the defaults. */
export const widgetSearchSchema = z.object({
	limit: z.coerce.number().int().min(1).max(10).default(5).catch(5),
	faculty: z.string().min(1).max(100).optional().catch(undefined),
	type: z.string().min(1).max(100).optional().catch(undefined),
});

export type WidgetSearch = z.infer<typeof widgetSearchSchema>;

export const fetchWidgetEventsServer = createServerFn({ method: "GET" })
	.validator((input: unknown) => widgetSearchSchema.parse(input))
	.handler(
		({ data }): Promise<PublicEvent[]> =>
			listUpcomingPublicEvents(new Date(), {
				limit: data.limit,
				...(data.faculty ? { facultySlug: data.faculty } : {}),
				...(data.type ? { typeSlug: data.type } : {}),
			}),
	);

export const widgetEventsQueryOptions = (search: WidgetSearch) =>
	queryOptions({
		queryKey: ["widget", search] as const,
		queryFn: () => fetchWidgetEventsServer({ data: search }),
	});
