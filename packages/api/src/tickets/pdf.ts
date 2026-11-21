/** Server-only: the printable ticket (never import from components). */
import {
	tickets_holder,
	tickets_show_at_entry,
	tickets_title,
} from "@repo/i18n/paraglide/messages";
import QRCode from "qrcode";
import {
	createPdf,
	drawCentered,
	formatLongDateTime,
	GREY,
	measure,
	NAVY,
} from "../pdf/document";
import { fitLines } from "../pdf/layout";
import { ticketQrText } from "./qr";

export type TicketPdfInput = {
	holderName: string;
	title: string;
	date: Date;
	place: string | null;
	ticketCode: string;
	locale: "pl" | "en";
};

/** A6 portrait (a phone-sized card), in PDF points. */
const PAGE = { width: 298, height: 420 };
const TEXT_WIDTH = PAGE.width - 40;
const QR_SIZE = 150;

/** One page: event, holder and the QR code the door scanner reads. */
export async function renderTicketPdf(
	input: TicketPdfInput,
): Promise<Uint8Array> {
	const { locale } = input;
	const { pdf, regular, bold } = await createPdf(
		`${tickets_title({}, { locale })} — ${input.title}`,
	);
	const page = pdf.addPage([PAGE.width, PAGE.height]);

	let y = PAGE.height - 36;
	drawCentered(page, tickets_title({}, { locale }), y, regular, 11, GREY);
	const title = fitLines(
		input.title,
		measure(bold),
		TEXT_WIDTH,
		[16, 14, 12],
		2,
	);
	for (const line of title.lines) {
		y -= title.size + 6;
		drawCentered(page, line, y, bold, title.size);
	}
	y -= 18;
	drawCentered(page, formatLongDateTime(input.date, locale), y, regular, 10);
	if (input.place) {
		y -= 14;
		const place = fitLines(
			input.place,
			measure(regular),
			TEXT_WIDTH,
			[10, 9],
			1,
		);
		drawCentered(page, place.lines[0] ?? "", y, regular, place.size);
	}

	const qr = await pdf.embedPng(
		await QRCode.toBuffer(ticketQrText(input.ticketCode), {
			margin: 1,
			width: 600,
		}),
	);
	y -= QR_SIZE + 14;
	page.drawImage(qr, {
		x: (PAGE.width - QR_SIZE) / 2,
		y,
		width: QR_SIZE,
		height: QR_SIZE,
	});
	y -= 16;
	drawCentered(
		page,
		tickets_show_at_entry({}, { locale }),
		y,
		regular,
		9,
		GREY,
	);

	y -= 22;
	drawCentered(page, tickets_holder({}, { locale }), y, regular, 9, GREY);
	y -= 14;
	const holder = fitLines(
		input.holderName,
		measure(bold),
		TEXT_WIDTH,
		[12, 10],
		1,
	);
	drawCentered(page, holder.lines[0] ?? "", y, bold, holder.size, NAVY);

	return pdf.save();
}
