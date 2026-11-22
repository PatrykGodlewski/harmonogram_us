import type { AgendaItem, EventRegistrant } from "@repo/api/admin/queries";
import {
	admin_registrants_csv,
	admin_registrants_csv_file,
	admin_registrants_xlsx,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import {
	type ExportQuestion,
	registrantRows,
	toRegistrantsCsv,
} from "@repo/ui/registrants-csv";
import { toEventDateInput } from "@repo/ui/time";

type RegistrantExportsProps = {
	eventTitle: string;
	registrants: EventRegistrant[];
	agenda: AgendaItem[];
	questions: ExportQuestion[];
};

/** CSV and XLSX downloads of the registrant list (built in the browser from the same rows). */
export function RegistrantExports({
	eventTitle,
	registrants,
	agenda,
	questions,
}: RegistrantExportsProps) {
	const baseName = `${admin_registrants_csv_file()}-${slugify(eventTitle)}-${toEventDateInput(new Date())}`;

	const handleCsv = () =>
		download(
			`${baseName}.csv`,
			new Blob(
				[toRegistrantsCsv(registrants, agenda, getLocale(), questions)],
				{
					type: "text/csv;charset=utf-8",
				},
			),
		);

	const handleXlsx = async () => {
		// Loaded on demand: most visits never export.
		const { default: writeXlsxFile } = await import("write-excel-file/browser");
		await writeXlsxFile(
			registrantRows(registrants, agenda, getLocale(), questions),
		).toFile(`${baseName}.xlsx`);
	};

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				onClick={handleCsv}
				disabled={registrants.length === 0}
			>
				{admin_registrants_csv()}
			</Button>
			<Button
				size="sm"
				variant="outline"
				onClick={() => void handleXlsx()}
				disabled={registrants.length === 0}
			>
				{admin_registrants_xlsx()}
			</Button>
		</>
	);
}

function slugify(text: string): string {
	return (
		text
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.replace(/ł/g, "l")
			.replace(/Ł/g, "L")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 40) || "wydarzenie"
	);
}

function download(filename: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	// Some browsers start the download after click() returns.
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
