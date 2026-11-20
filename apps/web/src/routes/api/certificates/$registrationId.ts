import { certificateResponse } from "@repo/api/certificates/response";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/certificates/$registrationId")({
	server: {
		handlers: {
			GET: ({ params }) => certificateResponse(params.registrationId),
		},
	},
});
