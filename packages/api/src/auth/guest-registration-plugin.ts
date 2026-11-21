import { DomainError } from "@repo/db/queries/domain-errors";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { z } from "zod";
import { requestGuestRegistration } from "../registrations/guest-registration";

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
		},
	}) satisfies BetterAuthPlugin;
