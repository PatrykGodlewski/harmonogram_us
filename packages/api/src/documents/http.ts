/** Server-only: answering a download with a PDF from the documents service. */
import { documents_unavailable } from "@repo/i18n/paraglide/messages";
import { isDocumentsBusy } from "@repo/rpc/documents";

/**
 * The rendered PDF as a private download. When the service is down or overloaded the
 * person gets a short "try again" message (503); any other failure is a bug and is rethrown.
 */
export async function pdfResponse(
	render: () => Promise<Uint8Array>,
	filename: string,
	locale: "pl" | "en",
): Promise<Response> {
	try {
		const pdf = await render();
		return new Response(Buffer.from(pdf), {
			headers: {
				"content-type": "application/pdf",
				"content-disposition": `attachment; filename="${filename}.pdf"`,
				"cache-control": "private, no-store",
			},
		});
	} catch (error) {
		if (!isDocumentsBusy(error)) throw error;
		return new Response(documents_unavailable({}, { locale }), {
			status: 503,
			headers: {
				"content-type": "text/plain; charset=utf-8",
				"retry-after": "5",
				"cache-control": "no-store",
			},
		});
	}
}
