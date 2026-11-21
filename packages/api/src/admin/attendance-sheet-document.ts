/** Server-only: the attendance sheet as a request for the documents service (text translated here). */
import {
	sheet_email,
	sheet_name,
	sheet_no,
	sheet_page,
	sheet_signature,
	sheet_title,
} from "@repo/i18n/paraglide/messages";
import type { RenderAttendanceSheetRequest } from "@repo/rpc/gen/harmonogram/documents/v1/documents_pb";
import { formatLongDateTime } from "../pdf/document";

export type AttendanceSheetInput = {
	eventTitle: string;
	eventDate: Date;
	people: { name: string; email: string }[];
	locale: "pl" | "en";
};

/**
 * Everything the sheet shows, as display-ready text. The service paginates, so the page
 * footer goes as a template it fills in ("Strona {page} z {pages}").
 */
export function attendanceSheetRequest(input: AttendanceSheetInput): Omit<
	RenderAttendanceSheetRequest,
	"$typeName" | "people"
> & {
	people: { name: string; email: string }[];
} {
	const { locale } = input;
	const title = sheet_title({}, { locale });
	return {
		documentTitle: `${title} — ${input.eventTitle}`,
		title,
		eventTitle: input.eventTitle,
		dateText: formatLongDateTime(input.eventDate, locale),
		noLabel: sheet_no({}, { locale }),
		nameLabel: sheet_name({}, { locale }),
		emailLabel: sheet_email({}, { locale }),
		signatureLabel: sheet_signature({}, { locale }),
		pageLabelTemplate: sheet_page(
			{ page: "{page}", pages: "{pages}" },
			{ locale },
		),
		people: input.people,
	};
}
