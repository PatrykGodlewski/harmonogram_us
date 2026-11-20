import {
	calendarLocale,
	eventCalendarResponse,
} from "@repo/api/calendar/feeds";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/calendar/event/$eventId")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				eventCalendarResponse(
					params.eventId,
					calendarLocale(request),
					new URL(request.url).searchParams.get("invite") ?? undefined,
				),
		},
	},
});
