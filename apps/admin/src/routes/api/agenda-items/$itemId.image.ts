import { panelItemImageResponse } from "@repo/api/files/item-image";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/agenda-items/$itemId/image")({
	server: {
		handlers: {
			GET: ({ params }) => panelItemImageResponse(params.itemId),
		},
	},
});
