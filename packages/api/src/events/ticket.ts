import { getMyTicket, type Ticket } from "@repo/db/queries/tickets";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "../auth/middleware";

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
 * Under ["my-registrations"], so a promotion refreshes an open waitlisted ticket too.
 */
export const ticketQueryOptions = (registrationId: string) =>
	queryOptions({
		queryKey: ["my-registrations", "ticket", registrationId] as const,
		queryFn: () => fetchTicketServer({ data: { registrationId } }),
	});
