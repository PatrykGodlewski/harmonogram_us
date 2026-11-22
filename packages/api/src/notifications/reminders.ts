import { queueDueReminders } from "@repo/db/queries/reminders";
import { enqueueEmails } from "@repo/jobs/client";

/** Queues reminder e-mails for every event due at `now` (the worker runs this every 5 minutes). */
export function queueDueReminderEmails(now: Date): Promise<{ events: number }> {
	return queueDueReminders(now, (tx, registrationIds) =>
		enqueueEmails(
			registrationIds.map((registrationId) => ({
				kind: "registration",
				registrationId,
				change: "reminder",
			})),
			{ tx },
		),
	);
}
