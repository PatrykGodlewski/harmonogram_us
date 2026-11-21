import { searchUsers, setUserRole } from "@repo/db/queries/roles";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminMiddleware } from "../auth/admin-middleware";
import { appError } from "../errors";

export type { UserListItem } from "@repo/db/queries/roles";

/** How many users one search returns. */
const USER_SEARCH_LIMIT = 50;

const searchUsersSchema = z.object({ query: z.string().max(200) });
const setUserRoleSchema = z.object({
	userId: z.string().min(1),
	role: z.enum(["user", "organizer", "admin"]),
});

export const searchUsersServer = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator((input: unknown) => searchUsersSchema.parse(input))
	.handler(async ({ data }) => searchUsers(data.query, USER_SEARCH_LIMIT));

export const searchUsersQueryOptions = (query: string) =>
	queryOptions({
		queryKey: ["admin", "users", query] as const,
		queryFn: () => searchUsersServer({ data: { query } }),
	});

export const setUserRoleServer = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator((input: unknown) => setUserRoleSchema.parse(input))
	.handler(async ({ data, context }) => {
		// An admin who demotes themselves could lock the instance out of its settings.
		if (data.userId === context.user.id) {
			throw appError("FORBIDDEN");
		}
		const user = await setUserRole(data.userId, data.role);
		if (!user) {
			throw appError("NOT_FOUND");
		}
		return user;
	});
