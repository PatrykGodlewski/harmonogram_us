/** What a ticket's QR code encodes (web card, PDF) and how the door scanner reads it back. */
const TICKET_QR_PREFIX = "harmonogram-ticket:";

export function ticketQrText(ticketCode: string): string {
	return `${TICKET_QR_PREFIX}${ticketCode}`;
}

/** The ticket code in a scanned QR text; null when it is not one of our tickets. */
export function ticketCodeFromQr(text: string): string | null {
	return text.startsWith(TICKET_QR_PREFIX)
		? text.slice(TICKET_QR_PREFIX.length)
		: null;
}
