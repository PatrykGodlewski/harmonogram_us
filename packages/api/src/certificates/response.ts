/** Server-only: the certificate download for the API route (never import from components). */
import { getCertificate } from "@repo/db/queries/certificates";
import { getCurrentSession } from "../auth/user";
import { renderCertificatePdf } from "./pdf";

const FILENAMES = { pl: "zaswiadczenie.pdf", en: "certificate.pdf" } as const;

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
	const pdf = await renderCertificatePdf({
		...certificate,
		reference: registrationId.slice(0, 8).toUpperCase(),
	});
	return new Response(Buffer.from(pdf), {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="${FILENAMES[certificate.locale]}"`,
			"cache-control": "private, no-store",
		},
	});
}
