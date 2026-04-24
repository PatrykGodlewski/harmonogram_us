import { createMiddleware } from "@tanstack/react-start";
import { getCurrentUser } from "./user";

export const authMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw new Error("UNAUTHORIZED");
	}

	return next({
		context: {
			user,
			isAuthenticated: true,
		},
	});
});
