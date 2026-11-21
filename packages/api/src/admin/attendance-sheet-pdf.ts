/** Server-only: the printable attendance sheet (never import from components). */
import {
	sheet_email,
	sheet_name,
	sheet_no,
	sheet_page,
	sheet_signature,
	sheet_title,
} from "@repo/i18n/paraglide/messages";
import { rgb } from "pdf-lib";
import {
	createPdf,
	formatLongDateTime,
	GREY,
	measure,
	NAVY,
} from "../pdf/document";
import { fitLines } from "../pdf/layout";

export type AttendanceSheetInput = {
	eventTitle: string;
	eventDate: Date;
	people: { name: string; email: string }[];
	locale: "pl" | "en";
};

/** A4 portrait, in PDF points. */
const PAGE = { width: 595, height: 842 };
const MARGIN = 40;
const ROW_HEIGHT = 28;
const FIRST_PAGE_ROWS = 24;
const PAGE_ROWS = 27;
/** Column x positions: no., name, e-mail, signature. */
const COLUMNS = {
	no: MARGIN,
	name: MARGIN + 30,
	email: MARGIN + 210,
	signature: MARGIN + 390,
};
const LINE = rgb(0.8, 0.82, 0.85);

/** Rows per page: the first page holds fewer (the title sits above the table). */
export function pageRows(
	total: number,
	first: number,
	perPage: number,
): number[] {
	if (total <= first) {
		return [total];
	}
	const pages = [first];
	for (let left = total - first; left > 0; left -= perPage) {
		pages.push(Math.min(left, perPage));
	}
	return pages;
}

/** Everyone with a place, one row each, with an empty box to sign. */
export async function renderAttendanceSheetPdf(
	input: AttendanceSheetInput,
): Promise<Uint8Array> {
	const { locale } = input;
	const { pdf, regular, bold } = await createPdf(
		`${sheet_title({}, { locale })} — ${input.eventTitle}`,
	);
	const pages = pageRows(input.people.length, FIRST_PAGE_ROWS, PAGE_ROWS);
	/** One line in a column: the largest size that fits (drawn at that size). */
	const cell = (text: string, width: number, sizes: number[]) => {
		const fitted = fitLines(text, measure(regular), width, sizes, 1);
		return { text: fitted.lines[0] ?? "", size: fitted.size };
	};

	let index = 0;
	for (const [pageIndex, rows] of pages.entries()) {
		const page = pdf.addPage([PAGE.width, PAGE.height]);
		let y = PAGE.height - MARGIN;
		if (pageIndex === 0) {
			page.drawText(sheet_title({}, { locale }), {
				x: MARGIN,
				y,
				size: 18,
				font: bold,
				color: NAVY,
			});
			const title = fitLines(
				input.eventTitle,
				measure(bold),
				PAGE.width - 2 * MARGIN,
				[13, 11],
				2,
			);
			for (const line of title.lines) {
				y -= 18;
				page.drawText(line, {
					x: MARGIN,
					y,
					size: title.size,
					font: bold,
					color: NAVY,
				});
			}
			y -= 16;
			page.drawText(formatLongDateTime(input.eventDate, locale), {
				x: MARGIN,
				y,
				size: 10,
				font: regular,
				color: GREY,
			});
			y -= 28;
		}
		const header = [
			[sheet_no({}, { locale }), COLUMNS.no],
			[sheet_name({}, { locale }), COLUMNS.name],
			[sheet_email({}, { locale }), COLUMNS.email],
			[sheet_signature({}, { locale }), COLUMNS.signature],
		] as const;
		for (const [label, x] of header) {
			page.drawText(label, { x, y, size: 9, font: bold, color: GREY });
		}
		y -= 8;
		page.drawLine({
			start: { x: MARGIN, y },
			end: { x: PAGE.width - MARGIN, y },
			color: GREY,
			thickness: 1,
		});
		for (let row = 0; row < rows; row++) {
			const person = input.people[index];
			index++;
			if (!person) break;
			const textY = y - 18;
			page.drawText(String(index), {
				x: COLUMNS.no,
				y: textY,
				size: 10,
				font: regular,
				color: NAVY,
			});
			const name = cell(
				person.name,
				COLUMNS.email - COLUMNS.name - 8,
				[10, 9, 8],
			);
			page.drawText(name.text, {
				x: COLUMNS.name,
				y: textY,
				size: name.size,
				font: regular,
				color: NAVY,
			});
			const email = cell(
				person.email,
				COLUMNS.signature - COLUMNS.email - 8,
				[9, 8],
			);
			page.drawText(email.text, {
				x: COLUMNS.email,
				y: textY,
				size: email.size,
				font: regular,
				color: GREY,
			});
			y -= ROW_HEIGHT;
			page.drawLine({
				start: { x: MARGIN, y },
				end: { x: PAGE.width - MARGIN, y },
				color: LINE,
				thickness: 0.5,
			});
		}
		page.drawText(
			sheet_page({ page: pageIndex + 1, pages: pages.length }, { locale }),
			{
				x: MARGIN,
				y: MARGIN / 2,
				size: 8,
				font: regular,
				color: GREY,
			},
		);
	}
	return pdf.save();
}
