import { createMiddleware } from "@tanstack/react-start";
import { getCurrentUser } from "./user";

/** Like `authMiddleware`, but only lets users with the admin role through. */
export const adminMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw new Error("UNAUTHORIZED");
	}
	if (!user.isAdmin) {
		throw new Error("FORBIDDEN");
	}

	return next({
		context: {
			user,
			isAuthenticated: true,
			isAdmin: true,
		},
	});
});
