import { getMonthlyActivity } from "@repo/db/queries/activity";
import { env } from "@repo/env/client";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "../auth/admin-middleware";

export type { MonthlyActivity } from "@repo/db/queries/activity";

const ACTIVITY_MONTHS = 12;

/** Events and registrations per month for administrators (F15). */
export const adminActivityServer = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(() => getMonthlyActivity(ACTIVITY_MONTHS, env.VITE_APP_TIME_ZONE));

export const adminActivityQueryOptions = queryOptions({
	queryKey: ["admin", "activity"] as const,
	queryFn: () => adminActivityServer(),
});
