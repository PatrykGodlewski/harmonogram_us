/** Server-only: renders attendance certificates (never import from components). */
import fontkit from "@pdf-lib/fontkit";
import { env } from "@repo/env/client";
import {
	certificate_date,
	certificate_footer,
	certificate_intro,
	certificate_person,
	certificate_title,
} from "@repo/i18n/paraglide/messages";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import boldFont from "./assets/NotoSans-Bold.ttf?inline";
import regularFont from "./assets/NotoSans-Regular.ttf?inline";

export type CertificateInput = {
	name: string;
	eventTitle: string;
	eventDate: Date;
	/** A short code that identifies the registration on paper. */
	reference: string;
	locale: "pl" | "en";
};

/** A4 landscape, in PDF points. */
const PAGE = { width: 842, height: 595 };
const NAVY = rgb(0.06, 0.16, 0.34);
const GREY = rgb(0.35, 0.38, 0.42);

function fontBytes(dataUrl: string): Uint8Array {
	return Uint8Array.from(
		Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
	);
}

function formatDate(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}

/** Splits text into lines that fit `maxWidth` (long titles wrap instead of running off the page). */
function wrap(
	text: string,
	font: PDFFont,
	size: number,
	maxWidth: number,
): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/)) {
		const candidate = line ? `${line} ${word}` : word;
		if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
			lines.push(line);
			line = word;
		} else {
			line = candidate;
		}
	}
	return line ? [...lines, line] : lines;
}

function drawCentered(
	page: PDFPage,
	text: string,
	y: number,
	font: PDFFont,
	size: number,
	color = NAVY,
): void {
	const x = (PAGE.width - font.widthOfTextAtSize(text, size)) / 2;
	page.drawText(text, { x, y, size, font, color });
}

/** One-page PDF confirming that the person attended the event. */
export async function renderCertificatePdf(
	input: CertificateInput,
): Promise<Uint8Array> {
	const { locale } = input;
	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	pdf.setTitle(`${certificate_title({}, { locale })} — ${input.eventTitle}`);
	const regular = await pdf.embedFont(fontBytes(regularFont), { subset: true });
	const bold = await pdf.embedFont(fontBytes(boldFont), { subset: true });
	const page = pdf.addPage([PAGE.width, PAGE.height]);

	page.drawRectangle({
		x: 24,
		y: 24,
		width: PAGE.width - 48,
		height: PAGE.height - 48,
		borderColor: NAVY,
		borderWidth: 2,
	});

	let y = 470;
	drawCentered(page, certificate_title({}, { locale }), y, bold, 34);
	y -= 56;
	drawCentered(page, certificate_person({}, { locale }), y, regular, 13, GREY);
	y -= 34;
	drawCentered(page, input.name, y, bold, 26);
	y -= 46;
	drawCentered(page, certificate_intro({}, { locale }), y, regular, 13, GREY);
	for (const line of wrap(input.eventTitle, bold, 20, PAGE.width - 160)) {
		y -= 30;
		drawCentered(page, line, y, bold, 20);
	}
	y -= 40;
	drawCentered(
		page,
		`${certificate_date({}, { locale })}: ${formatDate(input.eventDate, locale)}`,
		y,
		regular,
		14,
	);
	drawCentered(
		page,
		certificate_footer({ reference: input.reference }, { locale }),
		52,
		regular,
		10,
		GREY,
	);
	return pdf.save();
}
