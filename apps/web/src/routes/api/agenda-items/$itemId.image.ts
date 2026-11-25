import { publicItemImageResponse } from "@repo/api/files/item-image";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agenda-items/$itemId/image")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				publicItemImageResponse(
					params.itemId,
					new URL(request.url).searchParams.get("invite")?.slice(0, 128) ||
						undefined,
				),
		},
	},
});
