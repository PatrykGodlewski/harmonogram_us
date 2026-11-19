import type { RegistrationHooks } from "@repo/db/queries/event-registrations";
import { enqueueEmails } from "@repo/jobs/client";

/** Queues a registration e-mail for every state change, in the same transaction. */
export const registrationEmailHooks: RegistrationHooks = {
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
