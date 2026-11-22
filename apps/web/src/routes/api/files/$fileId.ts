import { publicFileResponse } from "@repo/api/files/download";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/$fileId")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				publicFileResponse(
					params.fileId,
					new URL(request.url).searchParams.get("invite")?.slice(0, 128) ||
						undefined,
				),
		},
	},
});
