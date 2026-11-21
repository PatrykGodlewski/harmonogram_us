import {
	getRegistrationForEmail,
	removeRegistrant,
} from "@repo/db/queries/event-registrations";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { appError, withDomainErrors } from "../errors";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import { isWithdrawTokenValid } from "./withdraw-link";

const withdrawByLinkSchema = z.object({
	registrationId: z.string().min(1).max(100),
	token: z.string().max(200),
});

/**
 * Withdraws the registration named in a signed e-mail link (F17), without signing in:
 * the place is freed and the waitlist promoted as for any withdrawal. The token is
 * checked first, so a wrong link says nothing about the registration.
 */
export const withdrawByLinkServer = createServerFn({ method: "POST" })
	.validator((input: unknown) => withdrawByLinkSchema.parse(input))
	.handler(async ({ data }) => {
		if (!isWithdrawTokenValid(data.registrationId, data.token)) {
			throw appError("WITHDRAW_LINK_INVALID");
		}
		const registration = await getRegistrationForEmail(data.registrationId);
		if (!registration) {
			throw appError("NOT_REGISTERED");
		}
		await withDomainErrors(() =>
			removeRegistrant(
				registration.eventId,
				data.registrationId,
				registrationEmailHooks,
			),
		);
		return { ok: true as const };
	});
