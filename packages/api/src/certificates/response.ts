/** Server-only: the certificate download for the API route (never import from components). */
import { getCertificate } from "@repo/db/queries/certificates";
import { documentsClient } from "@repo/rpc/documents";
import { getCurrentSession } from "../auth/user";
import { pdfResponse } from "../documents/http";
import { certificateDocumentRequest } from "./document";

const FILENAMES = { pl: "zaswiadczenie", en: "certificate" } as const;

/** The signed-in user's certificate for one of their registrations; 404 when there is none. */
export async function certificateResponse(
	registrationId: string,
): Promise<Response> {
	const session = await getCurrentSession();
	const certificate = session?.user
		? await getCertificate(registrationId, session.user.id)
		: null;
	if (!certificate) {
		return new Response("Not found", { status: 404 });
	}
	const request = certificateDocumentRequest({
		...certificate,
		reference: registrationId.slice(0, 8).toUpperCase(),
	});
	return pdfResponse(
		async () => (await documentsClient().renderCertificate(request)).pdf,
		FILENAMES[certificate.locale],
		certificate.locale,
	);
}
