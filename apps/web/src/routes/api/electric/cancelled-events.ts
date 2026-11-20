import { proxyShape } from "@repo/collections/electric-proxy";
import { shapes } from "@repo/collections/shapes";
import { env } from "@repo/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/electric/cancelled-events")({
	server: {
		handlers: {
			GET: ({ request }) =>
				proxyShape(request, shapes.cancelledEvents, {
					electricUrl: env.ELECTRIC_URL,
					secret: env.ELECTRIC_SECRET,
				}),
		},
	},
});
