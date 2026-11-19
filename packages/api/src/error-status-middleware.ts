import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { appErrorStatus } from "./errors";

/**
 * Global server-function middleware (each app's `src/start.ts`): an app error is answered
 * with its HTTP status (4xx), so only real failures are 5xx. Start sends a server
 * function's error with the status set by `setResponseStatus`, else 200.
 */
export const errorStatusMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		const status = appErrorStatus(error);
		if (status) {
			setResponseStatus(status);
		}
		throw error;
	}
});
