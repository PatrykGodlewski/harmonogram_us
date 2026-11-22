import { calendarLocale, myCalendarResponse } from "@repo/api/calendar/feeds";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/calendar/my/$token")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				myCalendarResponse(params.token, calendarLocale(request)),
		},
	},
});
