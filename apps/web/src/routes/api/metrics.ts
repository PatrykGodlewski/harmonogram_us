import { serveMetrics } from "@repo/api/observability/metrics-route";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/metrics")({
	server: {
		handlers: {
			GET: ({ request }) => serveMetrics(request),
		},
	},
});
