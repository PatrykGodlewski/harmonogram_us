import { panelEventImageResponse } from "@repo/api/event-images/serve";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/event-images/$eventId")({
	server: {
		handlers: {
			GET: ({ params }) => panelEventImageResponse(params.eventId),
		},
	},
});
