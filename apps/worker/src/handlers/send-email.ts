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

const EXPECTED_STATE = {
	confirmed: "registered",
	promoted: "registered",
	waitlisted: "waitlisted",
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
			if (!registration || registration.state !== EXPECTED_STATE[job.change]) {
				return;
			}
			const props = {
				change: job.change,
				locale: registration.locale,
				eventTitle: registration.eventTitle,
				eventDate: formatEventDateTime(
					registration.eventDate,
					registration.locale,
				),
				url: `${env.BETTER_AUTH_URL}/${registration.locale}/events/${registration.eventId}`,
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
