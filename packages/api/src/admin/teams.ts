import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { appError } from "../errors";
import { teamsConfig } from "../teams/graph";
import { ensureTeamsMeeting } from "../teams/meeting";

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
 * link the event's meeting link (F23); an event that already has a link keeps
 * it and gets no meeting.
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
		return { onlineUrl: await ensureTeamsMeeting(data.eventId, config) };
	});
