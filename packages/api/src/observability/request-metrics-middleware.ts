import { createMiddleware } from "@tanstack/react-start";
import { recordHttpRequest } from "./metrics";

/**
 * Global request middleware (each app's `src/start.ts`): counts every request and
 * records its duration by method, normalised route and status for Prometheus.
 */
export const requestMetricsMiddleware = createMiddleware().server(
	async ({ request, next }) => {
		const started = performance.now();
		const record = (status: number) =>
			recordHttpRequest({
				method: request.method,
				path: new URL(request.url).pathname,
				status,
				seconds: (performance.now() - started) / 1000,
			});
		try {
			const result = await next();
			record(result.response.status);
			return result;
		} catch (error) {
			// A client that went away (navigation, closed tab) is not a server failure.
			record(request.signal.aborted ? 499 : 500);
			throw error;
		}
	},
);
