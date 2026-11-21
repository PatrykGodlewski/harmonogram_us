import { calendarLocale } from "@repo/api/calendar/feeds";
import { ticketPdfResponse } from "@repo/api/tickets/response";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tickets/$registrationId/pdf")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				ticketPdfResponse(params.registrationId, calendarLocale(request)),
		},
	},
});
