import { DomainError } from "@repo/db/queries/domain-errors";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import {
	assertGuestRequestStillValid,
	takeGuestRequest,
} from "@repo/db/queries/guest-requests";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import { requestGuestRegistration } from "../registrations/guest-registration";
import { ensureVerifiedUser } from "./verified-user";

function guestError(code: string): APIError {
	return new APIError("BAD_REQUEST", { code, message: code });
}

/**
 * Guest registration (F17): a visitor asks to register with name and e-mail; the link in
 * the e-mail confirms. Better Auth endpoints, so the CAPTCHA plugin and our rate limits
 * (hooks.before) cover them.
 */
export const guestRegistration = () =>
	({
		id: "guest-registration",
		endpoints: {
			requestGuestRegistration: createAuthEndpoint(
				"/guest-registration/request",
				{
					method: "POST",
					body: z.object({
						eventId: z.string().min(1),
						email: z.email(),
						name: z.string().trim().min(1).max(200),
						locale: z.enum(["pl", "en"]),
						answers: z.record(z.string(), z.string()).default({}),
						inviteToken: z.string().optional(),
					}),
				},
				async (ctx) => {
					try {
						await requestGuestRegistration(ctx.body);
					} catch (error) {
						if (error instanceof DomainError) {
							throw guestError(error.code);
						}
						throw error;
					}
					return ctx.json({ ok: true });
				},
			),
			confirmGuestRegistration: createAuthEndpoint(
				"/guest-registration/confirm",
				{
					method: "POST",
					body: z.object({ token: z.string().min(1) }),
				},
				async (ctx) => {
					// Single use: the link is spent even if the registration below is refused.
					const request = await takeGuestRequest(ctx.body.token);
					if (!request) {
						throw guestError("GUEST_LINK_INVALID");
					}
					// The invite link may have been revoked, or the event closed to guests, since.
					try {
						await assertGuestRequestStillValid(request);
					} catch (error) {
						if (error instanceof DomainError) {
							throw guestError(error.code);
						}
						throw error;
					}
					// The link reached this inbox: it proves the address, like a magic link.
					const user = await ensureVerifiedUser(
						ctx.context.internalAdapter,
						request.email,
						request.name,
						"guest-registration",
					);
					let state: string;
					try {
						({ state } = await registerForEvent(
							request.eventId,
							user.id,
							request.locale,
							registrationEmailHooks,
							{ answers: request.answers },
						));
					} catch (error) {
						if (error instanceof DomainError) {
							throw guestError(error.code);
						}
						throw error;
					}
					const session = await ctx.context.internalAdapter.createSession(
						user.id,
					);
					await setSessionCookie(ctx, { session, user });
					return ctx.json({
						eventId: request.eventId,
						state,
						redirectTo: `/events/${request.eventId}`,
					});
				},
			),
		},
	}) satisfies BetterAuthPlugin;
