import type { RegistrationHooks } from "@repo/db/queries/event-registrations";
import { enqueueEmails } from "@repo/jobs/client";

/** Queues registration and event-change e-mails, in the same transaction as the change. */
export const registrationEmailHooks: RegistrationHooks = {
	onEventChanged: (tx, notice) =>
		enqueueEmails(
			notice.registrationIds.map((registrationId) => ({
				kind: "event-changed",
				registrationId,
				before: { ...notice.before, date: notice.before.date.toISOString() },
				after: { ...notice.after, date: notice.after.date.toISOString() },
			})),
			{ tx },
		),
	onChanged: (tx, changes) =>
		enqueueEmails(
			changes.map(({ registrationId, change }) => ({
				kind: "registration",
				registrationId,
				change,
			})),
			{ tx },
		),
};
