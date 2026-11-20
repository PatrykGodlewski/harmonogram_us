import {
	calendarLocale,
	publicCalendarResponse,
} from "@repo/api/calendar/feeds";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/calendar/events")({
	server: {
		handlers: {
			GET: ({ request }) => publicCalendarResponse(calendarLocale(request)),
		},
	},
});
