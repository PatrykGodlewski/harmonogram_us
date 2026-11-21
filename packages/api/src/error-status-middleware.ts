import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { appErrorStatus } from "./errors";

/**
 * Global server-function middleware (each app's `src/start.ts`): an app error is answered
 * with its HTTP status (4xx), so only real failures are 5xx. Start sends a server
 * function's error with the status set by `setResponseStatus`, else 200.
 *
 * Only for calls from the browser (`/_serverFn/…`): during server rendering the function
 * runs in-process, the status would apply to the whole page and, since Start v1, override
 * the loader's redirect or not-found (a signed-in-only event became a bare 401).
 */
export const errorStatusMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	try {
		return await next();
	} catch (error) {
		const status = appErrorStatus(error);
		if (status && isServerFunctionRequest()) {
			setResponseStatus(status);
		}
		throw error;
	}
});

function isServerFunctionRequest(): boolean {
	return new URL(getRequest().url).pathname.startsWith("/_serverFn/");
}
