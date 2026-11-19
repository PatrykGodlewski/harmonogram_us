import { describe, expect, it, vi } from "vitest";

const TOKEN = "test-metrics-token-1234567890";

async function serveWith(token: string | undefined) {
	vi.resetModules();
	vi.stubEnv("METRICS_TOKEN", token ?? "");
	const { serveMetrics } = await import("../src/observability/metrics-route");
	return serveMetrics;
}

describe("serveMetrics", () => {
	it("answers 404 when no token is configured", async () => {
		const serve = await serveWith(undefined);
		const response = await serve(new Request("http://x/api/metrics"));
		expect(response.status).toBe(404);
	});

	it("answers 404 for a wrong token and the metrics for the right one", async () => {
		const serve = await serveWith(TOKEN);
		const wrong = await serve(
			new Request("http://x/api/metrics", { headers: { authorization: "Bearer nope" } }),
		);
		expect(wrong.status).toBe(404);
		const right = await serve(
			new Request("http://x/api/metrics", { headers: { authorization: `Bearer ${TOKEN}` } }),
		);
		expect(right.status).toBe(200);
		expect(await right.text()).toContain("process_cpu_seconds_total");
	});
});
