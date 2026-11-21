import { DomainError } from "@repo/db/queries/domain-errors";
import {
	acceptInvitation,
	getInvitation,
} from "@repo/db/queries/group-members";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import { ensureVerifiedUser } from "./verified-user";

function invitationError(code: string): APIError {
	return new APIError("BAD_REQUEST", { code, message: code });
}

/**
 * Confirms a group invitation and signs the invited person in.
 * The invitation token (sent to that inbox, valid until the group deadline)
 * proves the email, like a magic link does. Same session steps as Better
 * Auth's magic-link plugin: find/create verified user → create session → cookie.
 */
export const groupInvitation = () =>
	({
		id: "group-invitation",
		endpoints: {
			acceptGroupInvitation: createAuthEndpoint(
				"/group-invitation/accept",
				{
					method: "POST",
					body: z.object({ token: z.string().min(1) }),
				},
				async (ctx) => {
					const { token } = ctx.body;
					const invitation = await getInvitation(token);
					if (!invitation) {
						throw invitationError("INVITATION_INVALID");
					}

					const adapter = ctx.context.internalAdapter;
					// The invitation e-mail proved the address, like a magic link.
					const user = await ensureVerifiedUser(
						adapter,
						invitation.email,
						invitation.email.split("@")[0] ?? invitation.email,
						"group-invitation",
					);

					let eventId: string;
					try {
						({ eventId } = await acceptInvitation(
							token,
							user.id,
							registrationEmailHooks,
						));
					} catch (error) {
						if (error instanceof DomainError) {
							throw invitationError(error.code);
						}
						throw error;
					}

					const session = await adapter.createSession(user.id);
					await setSessionCookie(ctx, { session, user });
					return ctx.json({
						eventId,
						redirectTo: `/events/${eventId}?joined=1`,
					});
				},
			),
		},
	}) satisfies BetterAuthPlugin;
