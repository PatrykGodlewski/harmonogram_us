import { env } from "@repo/env";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

/** What the public privacy notice needs from the server configuration. */
export const fetchPrivacyInfoServer = createServerFn({ method: "GET" }).handler(
	async () => ({
		retentionDays: env.REGISTRATION_RETENTION_DAYS,
		controller: env.PRIVACY_CONTROLLER ?? null,
		contactEmail: env.PRIVACY_CONTACT_EMAIL ?? null,
	}),
);

export const privacyInfoQueryOptions = queryOptions({
	queryKey: ["privacy-info"] as const,
	queryFn: () => fetchPrivacyInfoServer(),
	staleTime: Number.POSITIVE_INFINITY,
});
