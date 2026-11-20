import { queueReadyCertificates } from "@repo/db/queries/certificates";
import { enqueueEmails } from "@repo/jobs/client";

/** Queues "your certificate is ready" e-mails for events that ended by `now` (the worker runs this every 15 minutes). */
export function queueReadyCertificateEmails(
	now: Date,
): Promise<{ events: number }> {
	return queueReadyCertificates(now, (tx, registrationIds) =>
		enqueueEmails(
			registrationIds.map((registrationId) => ({
				kind: "registration",
				registrationId,
				change: "certificate",
			})),
			{ tx },
		),
	);
}
