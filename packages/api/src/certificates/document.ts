/** Server-only: the certificate as a request for the documents service (text translated here). */
import {
	certificate_date,
	certificate_footer,
	certificate_intro,
	certificate_person,
	certificate_title,
} from "@repo/i18n/paraglide/messages";
import type { RenderCertificateRequest } from "@repo/rpc/gen/harmonogram/documents/v1/documents_pb";
import { formatLongDate } from "../pdf/document";

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

/** Everything the certificate shows, as display-ready text; the service only lays it out. */
export function certificateDocumentRequest(
	input: CertificateInput,
): Omit<RenderCertificateRequest, "$typeName"> {
	const { locale } = input;
	const title = certificate_title({}, { locale });
	return {
		documentTitle: `${title} — ${input.eventTitle}`,
		issuer: input.issuer || undefined,
		title,
		personLabel: certificate_person({}, { locale }),
		name: input.name,
		intro: certificate_intro({}, { locale }),
		eventTitle: input.eventTitle,
		dateLine: `${certificate_date({}, { locale })}: ${formatLongDate(input.eventDate, locale)}`,
		note: input.note || undefined,
		signer: input.signer || undefined,
		footer: certificate_footer({ reference: input.reference }, { locale }),
	};
}
