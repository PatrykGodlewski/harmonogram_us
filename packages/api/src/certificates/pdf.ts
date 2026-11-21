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
		`${certificate_date({}, { locale })}: ${formatLongDate(input.eventDate, locale)}`,
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
