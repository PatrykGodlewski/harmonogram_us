import { publicEventImageResponse } from "@repo/api/event-images/serve";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/event-images/$eventId")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				publicEventImageResponse(
					params.eventId,
					new URL(request.url).searchParams.get("invite")?.slice(0, 128) ||
						undefined,
				),
		},
	},
});
