import { resetUnverifiedAccount } from "@repo/db/queries/account-safety";
import { EventRegistrationError } from "@repo/db/queries/event-registrations";
import {
	acceptInvitation,
	getInvitation,
} from "@repo/db/queries/group-members";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

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
					if (!invitation || invitation.status !== "invited") {
						throw invitationError("INVITATION_INVALID");
					}

					const adapter = ctx.context.internalAdapter;
					let user = (await adapter.findUserByEmail(invitation.email))?.user;
					if (user && !user.emailVerified) {
						await resetUnverifiedAccount(user.id);
						user = await adapter.updateUser(user.id, { emailVerified: true });
					}
					if (!user) {
						user = await adapter.createUser({
							email: invitation.email,
							name: invitation.email.split("@")[0] ?? invitation.email,
							emailVerified: true,
						});
					}

					let eventId: string;
					try {
						({ eventId } = await acceptInvitation(token, user.id));
					} catch (error) {
						if (error instanceof EventRegistrationError) {
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
