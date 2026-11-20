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
	csv_status_registered,
	csv_status_waitlisted,
	csv_yes,
} from "@repo/i18n/paraglide/messages";
import { formatEventDateTime } from "./time";

type Locale = "pl" | "en";

/** A spreadsheet runs these as formulas (CSV injection), also after leading spaces; `|` is DDE. */
const FORMULA_START = /^\s*[=+\-@|]|^[\t\r\n]/;

function cell(value: string): string {
	const safe = FORMULA_START.test(value) ? `'${value}` : value;
	return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * The registrant list as rows (header first) in the UI language: one source
 * for the CSV and the XLSX export, so both always carry the same columns.
 */
export function registrantRows(
	registrants: EventRegistrant[],
	agenda: { id: string; title: string }[],
	locale: Locale,
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
	];
	const rows = registrants.map((registrant) => [
		registrant.name ?? "",
		registrant.email,
		registrant.state === "registered"
			? csv_status_registered({}, options)
			: csv_status_waitlisted({}, options),
		formatEventDateTime(registrant.registeredAt, locale),
		registrant.groupName ?? "",
		registrant.agendaItemIds
			.map((id) => titleById.get(id))
			.filter(Boolean)
			.join(", "),
		registrant.checkedInAt ? csv_yes({}, options) : csv_no({}, options),
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
): string {
	return `\uFEFF${registrantRows(registrants, agenda, locale)
		.map((row) => row.map(cell).join(";"))
		.join("\r\n")}`;
}
