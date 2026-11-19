import { timingSafeEqual } from "node:crypto";
import { env } from "@repo/env";
import { metricsRegistry } from "./metrics";

function hasToken(request: Request, token: string): boolean {
	const given = Buffer.from(request.headers.get("authorization") ?? "");
	const expected = Buffer.from(`Bearer ${token}`);
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * GET handler for /api/metrics in each app. Only Prometheus, with METRICS_TOKEN as a
 * bearer token, gets the metrics; without a configured token the endpoint doesn't exist.
 */
export async function serveMetrics(request: Request): Promise<Response> {
	if (!env.METRICS_TOKEN || !hasToken(request, env.METRICS_TOKEN)) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(await metricsRegistry.metrics(), {
		headers: { "Content-Type": metricsRegistry.contentType },
	});
}
