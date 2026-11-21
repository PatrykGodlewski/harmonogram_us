/** Server-only: the attendance sheet download for the panel route (never import from components). */
import { canCheckIn } from "@repo/db/queries/event-organizers";
import { getEventRegistrants } from "@repo/db/queries/event-registrations";
import { getEventById } from "@repo/db/queries/events";
import { getCurrentUser } from "../auth/user";
import { renderAttendanceSheetPdf } from "./attendance-sheet-pdf";

/** Surname order (last word), the way paper lists are read at the door. */
function bySurname(locale: "pl" | "en") {
	const collator = new Intl.Collator(locale);
	const surname = (name: string) => name.trim().split(/\s+/).at(-1) ?? name;
	return (a: { name: string }, b: { name: string }) =>
		collator.compare(surname(a.name), surname(b.name)) ||
		collator.compare(a.name, b.name);
}

/** The PDF sheet of everyone with a place; 403 unless the user may check people in. */
export async function attendanceSheetResponse(
	eventId: string,
	locale: "pl" | "en",
): Promise<Response> {
	const user = await getCurrentUser();
	if (!user) {
		return new Response("Unauthorized", { status: 401 });
	}
	if (!(await canCheckIn(user, eventId))) {
		return new Response("Forbidden", { status: 403 });
	}
	const event = await getEventById(eventId, { kind: "manage" });
	if (!event) {
		return new Response("Not found", { status: 404 });
	}
	const people = (await getEventRegistrants(eventId, { withAnswers: false }))
		.filter((registrant) => registrant.state === "registered")
		.map((registrant) => ({
			name: registrant.name ?? registrant.email,
			email: registrant.email,
		}))
		.sort(bySurname(locale));
	const pdf = await renderAttendanceSheetPdf({
		eventTitle: event.title,
		eventDate: event.date,
		people,
		locale,
	});
	return new Response(Buffer.from(pdf), {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="${locale === "pl" ? "lista-obecnosci" : "attendance"}.pdf"`,
			"cache-control": "private, no-store",
		},
	});
}
