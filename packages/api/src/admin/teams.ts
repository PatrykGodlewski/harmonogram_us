import {
	getEventForMeeting,
	setOnlineUrlIfEmpty,
} from "@repo/db/queries/events";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { appError } from "../errors";
import { createTeamsMeeting, teamsConfig } from "../teams/graph";

/** Whether the panel offers "create a Teams meeting" (the installation has Teams set up). */
export const fetchTeamsAvailableServer = panelQueryFn.handler(
	async () => teamsConfig() !== null,
);

export const teamsAvailableQueryOptions = queryOptions({
	queryKey: ["admin", "teams-available"] as const,
	queryFn: () => fetchTeamsAvailableServer(),
	staleTime: Number.POSITIVE_INFINITY,
});

/**
 * Creates the Teams meeting of an online or hybrid event and makes its join
 * link the event's meeting link (F23). An event that already has a link keeps
 * it: the answer is then that link and no meeting is created.
 */
export const createTeamsMeetingServer = panelActionFn
	.validator((input: unknown) =>
		z.object({ eventId: z.string().min(1) }).parse(input),
	)
	.handler(async ({ data, context }): Promise<{ onlineUrl: string }> => {
		await assertCanManageEvent(context.user, data.eventId);
		const config = teamsConfig();
		if (!config) {
			throw appError("TEAMS_NOT_CONFIGURED");
		}
		const event = await getEventForMeeting(data.eventId);
		if (!event) {
			throw appError("EVENT_NOT_FOUND");
		}
		if (event.attendanceMode === "onsite") {
			throw appError("TEAMS_NOT_ONLINE");
		}
		let joinUrl: string;
		try {
			joinUrl = await createTeamsMeeting(config, {
				subject: event.title,
				start: event.start,
				end: event.end,
			});
		} catch (error) {
			console.error(`[teams] meeting for event ${data.eventId} failed:`, error);
			throw appError("TEAMS_FAILED");
		}
		const onlineUrl = await setOnlineUrlIfEmpty(data.eventId, joinUrl);
		if (!onlineUrl) {
			throw appError("EVENT_NOT_FOUND");
		}
		return { onlineUrl };
	});
