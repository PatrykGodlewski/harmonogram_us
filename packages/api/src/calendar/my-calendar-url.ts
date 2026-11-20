import { getCalendarToken } from "@repo/db/queries/calendar";
import { env } from "@repo/env";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../auth/user";

/** The signed-in person's feed URL (shown on the account page to copy). */
export const fetchMyCalendarUrlServer = createServerFn({
	method: "GET",
}).handler(async () => {
	const user = await getCurrentUser();
	const token = user ? await getCalendarToken(user.id) : null;
	return token ? `${env.BETTER_AUTH_URL}/api/calendar/my/${token}` : null;
});

export const myCalendarUrlQueryOptions = queryOptions({
	queryKey: ["my-calendar-url"] as const,
	queryFn: () => fetchMyCalendarUrlServer(),
	staleTime: Number.POSITIVE_INFINITY,
});
