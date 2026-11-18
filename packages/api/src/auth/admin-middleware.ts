import { createMiddleware } from "@tanstack/react-start";
import { appError } from "../errors";
import { getCurrentUser } from "./user";

/** Like `authMiddleware`, but only lets users with the admin role through. */
export const adminMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw appError("UNAUTHORIZED");
	}
	if (!user.isAdmin) {
		throw appError("FORBIDDEN");
	}

	return next({
		context: {
			user,
			isAuthenticated: true,
			isAdmin: true,
		},
	});
});
