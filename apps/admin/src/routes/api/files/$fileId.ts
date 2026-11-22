import { panelFileResponse } from "@repo/api/files/download";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/files/$fileId")({
	server: {
		handlers: {
			GET: ({ params }) => panelFileResponse(params.fileId),
		},
	},
});
