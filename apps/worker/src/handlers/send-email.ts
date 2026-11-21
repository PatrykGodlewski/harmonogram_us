import {
	renderEventChangeEmail,
	renderEventMessageEmail,
	renderGuestConfirmationEmail,
	renderRegistrationEmail,
	sendTransactionalEmail,
} from "@repo/api/notifications/email";
import { eventChangeEmailText } from "@repo/api/notifications/event-change-email";
import { eventMessageEmailText } from "@repo/api/notifications/event-message-email";
import { guestConfirmationEmail } from "@repo/api/notifications/guest-confirmation-email";
import { registrationEmailText } from "@repo/api/notifications/registration-email";
import { verificationEmail } from "@repo/api/notifications/verification-email";
import { getRegistrationForEmail } from "@repo/db/queries/event-registrations";
import { getInvitationEvent } from "@repo/db/queries/events";
import { env } from "@repo/env";
import {
	invitation_default_body,
	invitation_subject,
} from "@repo/i18n/paraglide/messages";
import type { EmailJob } from "@repo/jobs/queues";
import { formatEventDateTime } from "@repo/ui/time";

export type SendEmailDeps = { send: typeof sendTransactionalEmail };

export const defaultSendEmailDeps: SendEmailDeps = {
	send: sendTransactionalEmail,
};

/** The state a registration must still be in for its e-mail to make sense (null: any). */
const EXPECTED_STATE = {
	confirmed: "registered",
	promoted: "registered",
	waitlisted: "waitlisted",
	cancelled: null,
	reminder: "registered",
	pending: "pending",
	rejected: "rejected",
	certificate: "registered",
} as const;

/** Sends one queued e-mail. Errors propagate so pg-boss retries the job. */
export async function handleEmailJob(
	job: EmailJob,
	deps: SendEmailDeps = defaultSendEmailDeps,
): Promise<void> {
	switch (job.kind) {
		case "verification": {
			const { subject, text } = verificationEmail(job.url, job.locale);
			await deps.send({ to: job.to, subject, text });
			return;
		}
		case "guest-confirmation": {
			const props = {
				url: job.url,
				eventTitle: job.eventTitle,
				locale: job.locale,
			};
			const { subject, text } = guestConfirmationEmail(props);
			await deps.send({
				to: job.to,
				subject,
				text,
				html: await renderGuestConfirmationEmail(props),
			});
			return;
		}
		case "registration": {
			const registration = await getRegistrationForEmail(job.registrationId);
			// Withdrawn, or changed again before the job ran: nothing to tell.
			const expected = EXPECTED_STATE[job.change];
			if (
				!registration ||
				(expected !== null && registration.state !== expected) ||
				// Only the cancellation e-mail fits a cancelled event (a late "confirmed" would mislead).
				(job.change === "cancelled") !==
					(registration.eventStatus === "cancelled")
			) {
				return;
			}
			const appUrl = `${env.BETTER_AUTH_URL}/${registration.locale}`;
			const props = {
				change: job.change,
				locale: registration.locale,
				eventTitle: registration.eventTitle,
				eventDate: formatEventDateTime(
					registration.eventDate,
					registration.locale,
				),
				// The certificate is on the account page (sign-in first, then the download).
				// Certificates are on the account page; a declined person may no longer open an invite-only event.
				url:
					job.change === "certificate" || job.change === "rejected"
						? `${appUrl}/account`
						: `${appUrl}/events/${registration.eventId}`,
				ticketUrl:
					registration.state === "registered" &&
					job.change !== "cancelled" &&
					job.change !== "certificate"
						? `${appUrl}/tickets/${job.registrationId}`
						: undefined,
			};
			const { subject, text } = registrationEmailText(props);
			await deps.send({
				to: registration.email,
				subject,
				text,
				html: await renderRegistrationEmail(props),
			});
			return;
		}
		case "event-changed": {
			const registration = await getRegistrationForEmail(job.registrationId);
			// Withdrawn before the job ran, or the event was cancelled since: nothing to tell.
			if (!registration || registration.eventStatus !== "published") {
				return;
			}
			const { locale } = registration;
			const format = (iso: string) =>
				formatEventDateTime(new Date(iso), locale);
			const props = {
				locale,
				eventTitle: registration.eventTitle,
				date:
					job.before.date === job.after.date
						? null
						: {
								before: format(job.before.date),
								after: format(job.after.date),
							},
				place:
					job.before.place === job.after.place
						? null
						: { before: job.before.place, after: job.after.place },
				url: `${env.BETTER_AUTH_URL}/${locale}/events/${registration.eventId}`,
			};
			const { subject, text } = eventChangeEmailText(props);
			await deps.send({
				to: registration.email,
				subject,
				text,
				html: await renderEventChangeEmail(props),
			});
			return;
		}
		case "event-invitation": {
			const event = await getInvitationEvent(job.eventId);
			// Cancelled or unpublished since: an invitation would mislead.
			if (!event || event.status !== "published") {
				return;
			}
			const { locale } = job;
			const link = `${env.BETTER_AUTH_URL}/${locale}/events/${job.eventId}`;
			const props = {
				locale,
				eventTitle: event.title,
				subject: invitation_subject({}, { locale }),
				body:
					job.note ??
					invitation_default_body(
						{
							event: event.title,
							date: formatEventDateTime(event.date, locale),
						},
						{ locale },
					),
				url: event.inviteToken ? `${link}?invite=${event.inviteToken}` : link,
			};
			const { subject, text } = eventMessageEmailText(props);
			await deps.send({
				to: job.to,
				subject,
				text,
				html: await renderEventMessageEmail(props),
				replyTo: job.replyTo,
			});
			return;
		}
		case "event-message": {
			const registration = await getRegistrationForEmail(job.registrationId);
			// Withdrawn before the job ran: nothing to send.
			if (!registration) {
				return;
			}
			const props = {
				locale: registration.locale,
				eventTitle: registration.eventTitle,
				subject: job.subject,
				body: job.body,
				url: `${env.BETTER_AUTH_URL}/${registration.locale}/events/${registration.eventId}`,
			};
			const { subject, text } = eventMessageEmailText(props);
			await deps.send({
				to: registration.email,
				subject,
				text,
				html: await renderEventMessageEmail(props),
				replyTo: job.replyTo,
			});
			return;
		}
	}
}
