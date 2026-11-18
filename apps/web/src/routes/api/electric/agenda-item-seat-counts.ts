import { proxyShape } from "@repo/collections/electric-proxy";
import { shapes } from "@repo/collections/shapes";
import { env } from "@repo/env";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/electric/agenda-item-seat-counts")({
	server: {
		handlers: {
			GET: ({ request }: { request: Request }) =>
				proxyShape(request, shapes.agendaItemSeatCounts, {
					electricUrl: env.ELECTRIC_URL,
					secret: env.ELECTRIC_SECRET,
				}),
		},
	},
});
