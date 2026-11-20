import {
	renderRegistrationEmail,
	sendTransactionalEmail,
} from "@repo/api/notifications/email";
import { registrationEmailText } from "@repo/api/notifications/registration-email";
import { verificationEmail } from "@repo/api/notifications/verification-email";
import { getRegistrationForEmail } from "@repo/db/queries/event-registrations";
import { env } from "@repo/env";
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
		case "registration": {
			const registration = await getRegistrationForEmail(job.registrationId);
			// Withdrawn, or changed again before the job ran: nothing to tell.
			const expected = EXPECTED_STATE[job.change];
			if (
				!registration ||
				(expected !== null && registration.state !== expected) ||
				(job.change === "cancelled" && registration.eventStatus !== "cancelled")
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
				url: `${appUrl}/events/${registration.eventId}`,
				ticketUrl:
					registration.state === "registered" && job.change !== "cancelled"
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
	}
}
