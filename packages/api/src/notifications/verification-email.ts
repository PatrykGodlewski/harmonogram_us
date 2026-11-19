import {
	verify_email_ignore,
	verify_email_intro,
	verify_email_subject,
} from "@repo/i18n/paraglide/messages";

/** Subject and text of the e-mail-address verification message. */
export function verificationEmail(
	url: string,
	locale: "pl" | "en",
): { subject: string; text: string } {
	return {
		subject: verify_email_subject({}, { locale }),
		text: `${verify_email_intro({}, { locale })}\n\n${url}\n\n${verify_email_ignore({}, { locale })}`,
	};
}
