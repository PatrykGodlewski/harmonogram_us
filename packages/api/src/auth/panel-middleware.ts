import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { appError } from "../errors";
import { getCurrentUser } from "./user";

/** Lets through anyone who may open the admin panel; event access is checked per handler. */
export const panelMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const user = await getCurrentUser();
	if (!user) {
		throw appError("UNAUTHORIZED");
	}
	if (!user.hasPanelAccess) {
		throw appError("FORBIDDEN");
	}
	return next({ context: { user } });
});

export const panelQueryFn = createServerFn({ method: "GET" }).middleware([
	panelMiddleware,
]);

export const panelActionFn = createServerFn({ method: "POST" }).middleware([
	panelMiddleware,
]);
