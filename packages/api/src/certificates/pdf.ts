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
import { fitLines, type MeasureText } from "./layout";

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

/** Decoded once per process, not per download. */
const FONTS = { regular: fontBytes(regularFont), bold: fontBytes(boldFont) };
/** Text must stay inside the border with a margin. */
const TEXT_WIDTH = PAGE.width - 160;

function formatDate(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}

const measure =
	(font: PDFFont): MeasureText =>
	(text, size) =>
		font.widthOfTextAtSize(text, size);

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
	const regular = await pdf.embedFont(FONTS.regular, { subset: true });
	const bold = await pdf.embedFont(FONTS.bold, { subset: true });
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
	const name = fitLines(
		input.name,
		measure(bold),
		TEXT_WIDTH,
		[26, 22, 18, 14],
		1,
	);
	drawCentered(page, name.lines[0] ?? "", y, bold, name.size);
	y -= 46;
	drawCentered(page, certificate_intro({}, { locale }), y, regular, 13, GREY);
	// At most three lines, so the date never reaches the footer.
	const title = fitLines(
		input.eventTitle,
		measure(bold),
		TEXT_WIDTH,
		[20, 17, 14],
		3,
	);
	for (const line of title.lines) {
		y -= title.size + 10;
		drawCentered(page, line, y, bold, title.size);
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
