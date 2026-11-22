import { queueSurveyInvitations } from "@repo/db/queries/surveys";
import { enqueueEmails } from "@repo/jobs/client";

/** Queues survey e-mails for events whose survey opened by `now` (the worker runs this every 15 minutes). */
export function queueSurveyEmails(
	now: Date,
): Promise<{ registrations: number }> {
	return queueSurveyInvitations(now, (tx, registrationIds) =>
		enqueueEmails(
			registrationIds.map((registrationId) => ({
				kind: "registration",
				registrationId,
				change: "survey",
			})),
			{ tx },
		),
	);
}
