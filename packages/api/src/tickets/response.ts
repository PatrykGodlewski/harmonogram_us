/** Server-only: the PDF ticket download for the API route (never import from components). */
import { getMyTicket } from "@repo/db/queries/tickets";
import { documentsClient } from "@repo/rpc/documents";
import { getCurrentSession } from "../auth/user";
import { pdfResponse } from "../documents/http";
import { ticketDocumentRequest } from "./document";

/** The signed-in user's ticket with a place, as a PDF; 404 otherwise. */
export async function ticketPdfResponse(
	registrationId: string,
	locale: "pl" | "en",
): Promise<Response> {
	const session = await getCurrentSession();
	const ticket = session?.user
		? await getMyTicket(registrationId, session.user.id)
		: null;
	if (!ticket || ticket.state !== "registered") {
		return new Response("Not found", { status: 404 });
	}
	const request = ticketDocumentRequest({
		holderName: ticket.holderName,
		title: ticket.title,
		date: ticket.date,
		place: ticket.locationLabel,
		ticketCode: ticket.ticketCode,
		locale,
	});
	return pdfResponse(
		async () => (await documentsClient().renderTicket(request)).pdf,
		locale === "pl" ? "bilet" : "ticket",
		locale,
	);
}
