import type { EventRegistrant } from "@repo/db/queries/event-registrations";
import {
	csv_header_attendance,
	csv_header_email,
	csv_header_group,
	csv_header_items,
	csv_header_name,
	csv_header_registered_at,
	csv_header_status,
	csv_no,
	csv_status_pending,
	csv_status_registered,
	csv_status_rejected,
	csv_status_waitlisted,
	csv_yes,
} from "@repo/i18n/paraglide/messages";
import { formatEventDateTime } from "./time";

type Locale = "pl" | "en";

const STATUS_LABELS = {
	registered: csv_status_registered,
	waitlisted: csv_status_waitlisted,
	pending: csv_status_pending,
	rejected: csv_status_rejected,
} as const satisfies Record<EventRegistrant["state"], unknown>;

/** A spreadsheet runs these as formulas (CSV injection), also after leading spaces; `|` is DDE. */
const FORMULA_START = /^\s*[=+\-@|]|^[\t\r\n]/;

function cell(value: string): string {
	const safe = FORMULA_START.test(value) ? `'${value}` : value;
	return `"${safe.replaceAll('"', '""')}"`;
}

/** A registration question, as a column of the export. */
export type ExportQuestion = {
	id: string;
	label: string;
	kind: "text" | "choice" | "yesno";
};

/**
 * The registrant list as rows (header first) in the UI language: one source
 * for the CSV and the XLSX export, so both always carry the same columns.
 */
export function registrantRows(
	registrants: EventRegistrant[],
	agenda: { id: string; title: string }[],
	locale: Locale,
	questions: ExportQuestion[] = [],
): string[][] {
	const options = { locale };
	const titleById = new Map(agenda.map((item) => [item.id, item.title]));
	const header = [
		csv_header_name({}, options),
		csv_header_email({}, options),
		csv_header_status({}, options),
		csv_header_registered_at({}, options),
		csv_header_group({}, options),
		csv_header_items({}, options),
		csv_header_attendance({}, options),
		...questions.map((question) => question.label),
	];
	const answerText = (question: ExportQuestion, value: string | undefined) =>
		value === undefined
			? ""
			: question.kind === "yesno"
				? (value === "yes" ? csv_yes : csv_no)({}, options)
				: value;
	const rows = registrants.map((registrant) => [
		registrant.name ?? "",
		registrant.email,
		STATUS_LABELS[registrant.state]({}, options),
		formatEventDateTime(registrant.registeredAt, locale),
		registrant.groupName ?? "",
		registrant.agendaItemIds
			.map((id) => titleById.get(id))
			.filter(Boolean)
			.join(", "),
		registrant.checkedInAt ? csv_yes({}, options) : csv_no({}, options),
		...questions.map((question) =>
			answerText(question, registrant.answers[question.id]),
		),
	]);
	return [header, ...rows];
}

/**
 * The registrant list as CSV for spreadsheets: a UTF-8 BOM (so Excel reads
 * Polish letters), `;` separators, CRLF line ends, dates in the installation
 * time zone.
 */
export function toRegistrantsCsv(
	registrants: EventRegistrant[],
	agenda: { id: string; title: string }[],
	locale: Locale,
	questions: ExportQuestion[] = [],
): string {
	return `\uFEFF${registrantRows(registrants, agenda, locale, questions)
		.map((row) => row.map(cell).join(";"))
		.join("\r\n")}`;
}
