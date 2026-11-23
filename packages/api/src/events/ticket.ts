import { getMyTicket, type Ticket } from "@repo/db/queries/tickets";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";
import { LIVE_REFRESH_MS } from "./live-refresh";

export type { Ticket } from "@repo/db/queries/tickets";

const ticketInputSchema = z.object({
	registrationId: z.string().min(1).max(64),
});

export const fetchTicketServer = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.validator(ticketInputSchema)
	.handler(
		async ({ data, context }): Promise<Ticket | null> =>
			getMyTicket(data.registrationId, context.user.id),
	);

/**
 * The signed-in user's ticket for one of their registrations; null when it isn't theirs.
 * Under ["my-registrations"], so the user's own actions refresh it. While waitlisted it
 * polls, so a promotion (someone else's action) turns it into a ticket on the open page.
 */
export const ticketQueryOptions = (registrationId: string) =>
	queryOptions({
		queryKey: ["my-registrations", "ticket", registrationId] as const,
		queryFn: () => fetchTicketServer({ data: { registrationId } }),
		refetchInterval: (query) =>
			query.state.data?.state === "waitlisted" ? LIVE_REFRESH_MS : false,
	});
