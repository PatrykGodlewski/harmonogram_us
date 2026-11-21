import {
	guest_email_ignore,
	guest_email_intro,
	guest_email_subject,
} from "@repo/i18n/paraglide/messages";

/** Subject and text of the "confirm your registration" message sent to a guest (F17). */
export function guestConfirmationEmail(
	url: string,
	eventTitle: string,
	locale: "pl" | "en",
): { subject: string; text: string } {
	return {
		subject: guest_email_subject({ title: eventTitle }, { locale }),
		text: `${guest_email_intro({ title: eventTitle }, { locale })}\n\n${url}\n\n${guest_email_ignore({}, { locale })}`,
	};
}
