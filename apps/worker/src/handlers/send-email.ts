import { sendTransactionalEmail } from "@repo/api/notifications/email";
import { verificationEmail } from "@repo/api/notifications/verification-email";
import type { EmailJob } from "@repo/jobs/queues";

export type SendEmailDeps = { send: typeof sendTransactionalEmail };

export const defaultSendEmailDeps: SendEmailDeps = {
	send: sendTransactionalEmail,
};

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
	}
}
