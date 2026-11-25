/** Server-only: guest registration requests (F17). */
import { createGuestRequest } from "@repo/db/queries/guest-requests";
import type { Answers } from "@repo/db/queries/registration-answers";
import { env } from "@repo/env";
import { enqueueEmails } from "@repo/jobs/client";

export type GuestRegistrationInput = {
	eventId: string;
	email: string;
	name: string;
	locale: "pl" | "en";
	answers: Answers;
	inviteToken?: string;
};

/**
 * Stores the request (holds no place) and queues the confirmation e-mail in the same
 * transaction; domain errors (EVENT_NOT_FOUND, ANSWERS_INVALID, …) propagate.
 */
export async function requestGuestRegistration(
	input: GuestRegistrationInput,
): Promise<void> {
	await createGuestRequest(input, async (tx, token, event) => {
		const url = new URL(`/${input.locale}/guest/confirm`, env.BETTER_AUTH_URL);
		url.searchParams.set("token", token);
		await enqueueEmails(
			[
				{
					kind: "guest-confirmation",
					to: input.email.trim().toLowerCase(),
					url: url.toString(),
					eventTitle: event.title,
					locale: input.locale,
				},
			],
			{ tx },
		);
	});
}
