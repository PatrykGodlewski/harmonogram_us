/** Server-only: the ticket as a request for the documents service (text translated here). */
import {
	tickets_holder,
	tickets_show_at_entry,
	tickets_title,
} from "@repo/i18n/paraglide/messages";
import type { RenderTicketRequest } from "@repo/rpc/gen/harmonogram/documents/v1/documents_pb";
import { formatLongDateTime } from "../pdf/document";
import { ticketQrText } from "./qr";

export type TicketPdfInput = {
	holderName: string;
	title: string;
	date: Date;
	place: string | null;
	ticketCode: string;
	locale: "pl" | "en";
};

/** Everything the ticket shows, as display-ready text; the service only lays it out. */
export function ticketDocumentRequest(
	input: TicketPdfInput,
): Omit<RenderTicketRequest, "$typeName"> {
	const { locale } = input;
	const heading = tickets_title({}, { locale });
	return {
		documentTitle: `${heading} — ${input.title}`,
		heading,
		eventTitle: input.title,
		dateText: formatLongDateTime(input.date, locale),
		place: input.place ?? undefined,
		qrText: ticketQrText(input.ticketCode),
		showAtEntry: tickets_show_at_entry({}, { locale }),
		holderLabel: tickets_holder({}, { locale }),
		holderName: input.holderName,
	};
}
