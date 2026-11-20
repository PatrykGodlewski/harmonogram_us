import { describe, expect, it } from "vitest";
import { metricsRegistry, recordHttpRequest, routeLabel } from "../src/observability/metrics";

describe("routeLabel", () => {
	it.each([
		["/pl", "/:locale"],
		[
			`/api/calendar/my/${"a1".repeat(32)}`,
			"/api/calendar/my/:id",
		],
		["/en/events/6f1c2a4e-1b2c-4d5e-8f90-123456789abc", "/:locale/events/:id"],
		["/pl/tickets/0f8b7e6d-5c4b-4a39-8281-7f6e5d4c3b2a", "/:locale/tickets/:id"],
		["/pl/events/evt-1", "/:locale/events/:id"],
		[`/_serverFn/${"a".repeat(64)}`, `/_serverFn/${"a".repeat(64)}`],
		["/api/electric/event-seat-counts", "/api/electric/event-seat-counts"],
		["/assets/index-B1x2.js", "/assets/*"],
		["/a/b/c/d/e/f", "/a/b/c/d/*"],
		// Secrets in paths (invitation tokens, join codes) must never become label values.
		["/pl/invite/Vlm3RDQMKYxLkUzDbTLZGdb544muhThSsVrXXqujB2M", "/:locale/invite/:id"],
		["/pl/join/AB12CD", "/:locale/join/:id"],
		["/pl/events/6f1c2a4e-1b2c-4d5e-8f90-123456789abc/groups/new", "/:locale/events/:id/groups/*"],
	])("%s → %s", (path, label) => {
		expect(routeLabel(path)).toBe(label);
	});
});

describe("recordHttpRequest", () => {
	it("exposes request count and duration by method, route and status", async () => {
		recordHttpRequest({ method: "GET", path: "/pl/events/evt-1", status: 200, seconds: 0.12 });
		const text = await metricsRegistry.metrics();
		expect(text).toContain(
			'http_requests_total{method="GET",route="/:locale/events/:id",status_code="200"} 1',
		);
		expect(text).toContain("http_request_duration_seconds_bucket");
		expect(text).toContain("process_cpu_seconds_total");
	});
});
