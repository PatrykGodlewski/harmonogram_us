import { createMiddleware } from "@tanstack/react-start";
import { appError } from "../errors";
import { getCurrentUser } from "./user";

export const authMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw appError("UNAUTHORIZED");
	}

	return next({
		context: {
			user,
			isAuthenticated: true,
		},
	});
});
