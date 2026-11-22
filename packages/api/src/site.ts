import { env } from "@repo/env";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

/** The public site's address, for absolute links (link previews, calendar). */
export const fetchSiteUrlServer = createServerFn({ method: "GET" }).handler(
	async () => env.BETTER_AUTH_URL,
);

export const siteUrlQueryOptions = queryOptions({
	queryKey: ["site-url"] as const,
	queryFn: () => fetchSiteUrlServer(),
	staleTime: Number.POSITIVE_INFINITY,
});
