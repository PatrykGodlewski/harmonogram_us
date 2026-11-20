import {
	Counter,
	collectDefaultMetrics,
	Histogram,
	Registry,
} from "@prometheus-io/client";

/** One registry per app process, exposed at /api/metrics (see metrics-route.ts). */
export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const labelNames = ["method", "route", "status_code"] as const;

const httpRequestDuration = new Histogram({
	name: "http_request_duration_seconds",
	help: "Duration of HTTP requests in seconds",
	labelNames,
	buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	registers: [metricsRegistry],
});

const httpRequestsTotal = new Counter({
	name: "http_requests_total",
	help: "Total number of HTTP requests",
	labelNames,
	registers: [metricsRegistry],
});

const LOCALE = /^(pl|en)$/;
const ID =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|evt-[\w-]+|\d+)$/i;
/** Segments after these are ids, tokens or codes, whatever they look like (never label values). */
const ID_PARENTS = new Set([
	"events",
	"tickets",
	"certificates",
	"groups",
	"invite",
	"join",
	// Personal calendar feeds: the segment after "my" is a secret token.
	"my",
]);
const MAX_SEGMENTS = 4;

/**
 * A route label with bounded cardinality: the locale and ids become placeholders,
 * static assets collapse, and deep or unknown paths are cut after a few segments.
 * Server function ids stay: there is one per server function.
 */
export function routeLabel(pathname: string): string {
	const segments = pathname.split("/").filter(Boolean);
	if (segments[0] === "assets" || segments[0] === "_build") {
		return `/${segments[0]}/*`;
	}
	const labelled = segments.map((segment, index) => {
		if (index === 0 && LOCALE.test(segment)) return ":locale";
		const parent = segments[index - 1] ?? "";
		return ID_PARENTS.has(parent) || ID.test(segment) ? ":id" : segment;
	});
	const cut = labelled.length > MAX_SEGMENTS;
	return `/${labelled.slice(0, MAX_SEGMENTS).join("/")}${cut ? "/*" : ""}`;
}

export function recordHttpRequest(request: {
	method: string;
	path: string;
	status: number;
	seconds: number;
}): void {
	const labels = {
		method: request.method,
		route: routeLabel(request.path),
		status_code: String(request.status),
	};
	httpRequestDuration.observe(labels, request.seconds);
	httpRequestsTotal.inc(labels);
}
