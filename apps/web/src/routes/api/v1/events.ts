import { publicEventsResponse } from "@repo/api/public/events-api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/events")({
	server: {
		handlers: {
			GET: ({ request }) => publicEventsResponse(request),
		},
	},
});
