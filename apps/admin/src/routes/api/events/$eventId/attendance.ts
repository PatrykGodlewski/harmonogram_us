import { attendanceSheetResponse } from "@repo/api/admin/attendance-sheet";
import { calendarLocale } from "@repo/api/calendar/feeds";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/events/$eventId/attendance")({
	server: {
		handlers: {
			GET: ({ params, request }) =>
				attendanceSheetResponse(params.eventId, calendarLocale(request)),
		},
	},
});
