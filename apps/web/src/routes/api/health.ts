import { serveHealth } from "@repo/api/observability/health-route";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
	server: {
		handlers: {
			GET: () => serveHealth(),
		},
	},
});
