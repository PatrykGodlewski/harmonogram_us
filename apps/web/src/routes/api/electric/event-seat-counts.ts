import { env } from "@repo/env";
import { createFileRoute } from "@tanstack/react-router";

const FORWARDED_PARAMS = [
	"offset",
	"handle",
	"live",
	"cursor",
	"where",
	"params",
] as const;

export const Route = createFileRoute("/api/electric/event-seat-counts")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				const incomingUrl = new URL(request.url);
				const origin = new URL(`${env.ELECTRIC_URL}/v1/shape`);

				origin.searchParams.set("table", "event_seat_counts");
				origin.searchParams.set(
					"columns",
					"event_id,seats_remaining,max_seats,updated_at",
				);

				for (const param of FORWARDED_PARAMS) {
					const value = incomingUrl.searchParams.get(param);
					if (value !== null) {
						origin.searchParams.set(param, value);
					}
				}

				if (env.ELECTRIC_SECRET) {
					origin.searchParams.set("secret", env.ELECTRIC_SECRET);
				}

				const response = await fetch(origin, {
					headers: {
						accept: request.headers.get("accept") ?? "application/json",
					},
					cache: "no-store",
				});

				const headers = new Headers(response.headers);

				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers,
				});
			},
		},
	},
});
