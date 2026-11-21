/** Server-only: renders attendance certificates (never import from components). */
import {
	certificate_date,
	certificate_footer,
	certificate_intro,
	certificate_person,
	certificate_title,
} from "@repo/i18n/paraglide/messages";
import {
	createPdf,
	drawCentered,
	formatLongDate,
	GREY,
	measure,
	NAVY,
} from "../pdf/document";
import { fitLines } from "../pdf/layout";

export type CertificateInput = {
	name: string;
	eventTitle: string;
	eventDate: Date;
	/** A short code that identifies the registration on paper. */
	reference: string;
	locale: "pl" | "en";
	/** Set by the organiser: who issues it, a signer line, an extra line. */
	issuer?: string | null;
	signer?: string | null;
	note?: string | null;
};

/** A4 landscape, in PDF points. */
const PAGE = { width: 842, height: 595 };
/** Text must stay inside the border with a margin. */
const TEXT_WIDTH = PAGE.width - 160;

/** One-page PDF confirming that the person attended the event. */
export async function renderCertificatePdf(
	input: CertificateInput,
): Promise<Uint8Array> {
	const { locale } = input;
	const { pdf, regular, bold } = await createPdf(
		`${certificate_title({}, { locale })} — ${input.eventTitle}`,
	);
	const page = pdf.addPage([PAGE.width, PAGE.height]);

	page.drawRectangle({
		x: 24,
		y: 24,
		width: PAGE.width - 48,
		height: PAGE.height - 48,
		borderColor: NAVY,
		borderWidth: 2,
	});

	if (input.issuer) {
		const issuer = fitLines(
			input.issuer,
			measure(regular),
			TEXT_WIDTH,
			[13, 11],
			1,
		);
		drawCentered(page, issuer.lines[0] ?? "", 515, regular, issuer.size, GREY);
	}
	let y = 470;
	drawCentered(page, certificate_title({}, { locale }), y, bold, 34);
	y -= 56;
	drawCentered(page, certificate_person({}, { locale }), y, regular, 13, GREY);
	y -= 34;
	// A name is never cut: it shrinks, then takes a second line.
	const name = fitLines(
		input.name,
		measure(bold),
		TEXT_WIDTH,
		[26, 22, 18, 14],
		2,
	);
	for (const [index, line] of name.lines.entries()) {
		if (index > 0) y -= name.size + 6;
		drawCentered(page, line, y, bold, name.size);
	}
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
		`${certificate_date({}, { locale })}: ${formatLongDate(input.eventDate, locale)}`,
		y,
		regular,
		14,
	);
	if (input.note) {
		const note = fitLines(
			input.note,
			measure(regular),
			TEXT_WIDTH,
			[12, 10],
			1,
		);
		drawCentered(page, note.lines[0] ?? "", y - 22, regular, note.size);
	}
	if (input.signer) {
		// A line to sign above the signer's name, bottom right.
		const signer = fitLines(input.signer, measure(regular), 260, [11, 9], 1);
		const right = PAGE.width - 80;
		page.drawLine({
			start: { x: right - 260, y: 104 },
			end: { x: right, y: 104 },
			color: GREY,
			thickness: 0.75,
		});
		const text = signer.lines[0] ?? "";
		page.drawText(text, {
			x: right - regular.widthOfTextAtSize(text, signer.size),
			y: 88,
			size: signer.size,
			font: regular,
			color: NAVY,
		});
	}
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
