import { removeMember, setMemberItems } from "@repo/db/queries/group-members";
import {
	closeGroup,
	createGroup,
	type InvitationHooks,
	inviteToGroup,
	joinGroup,
	resendInvitation,
	updateGroup,
} from "@repo/db/queries/groups";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { enqueueInvitationEmails } from "@repo/jobs/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { authMiddleware } from "../auth/middleware";
import { withDomainErrors } from "../errors";
import { getClientIp } from "../security/client-ip";
import { assertEmailsAllowed } from "../security/email-policy";
import { consumeRateLimit } from "../security/rate-limit";
import {
	JOIN_GROUP_LIMIT,
	joinGroupRateKey,
} from "../security/rate-limit-keys";
import { assertTurnstile } from "../security/turnstile";
import {
	createGroupSchema,
	groupIdSchema,
	inviteToGroupSchema,
	joinGroupSchema,
	memberIdSchema,
	setMemberItemsSchema,
	updateGroupSchema,
} from "./schemas";

const protectedActionFn = createServerFn({ method: "POST" }).middleware([
	authMiddleware,
]);

function currentEmailLocale(): "pl" | "en" {
	return getLocale() === "en" ? "en" : "pl";
}

/** Invitation emails are queued inside the group transaction (they commit or roll back with it). */
function invitationHooks(): InvitationHooks {
	const locale = currentEmailLocale();
	return {
		onInvited: (tx, refs) =>
			enqueueInvitationEmails(
				refs.map((ref) => ({ memberId: ref.memberId, locale })),
				{ tx },
			),
	};
}

export const createGroupServer = protectedActionFn
	.inputValidator(createGroupSchema)
	.handler(async ({ data, context }) => {
		await assertEmailsAllowed(data.emails);
		const result = await withDomainErrors(() =>
			createGroup({ ...data, ownerUserId: context.user.id }, invitationHooks()),
		);
		return { groupId: result.groupId };
	});

export const inviteToGroupServer = protectedActionFn
	.inputValidator(inviteToGroupSchema)
	.handler(async ({ data, context }) => {
		await assertEmailsAllowed(data.emails);
		const refs = await withDomainErrors(() =>
			inviteToGroup(
				data.groupId,
				context.user.id,
				data.emails,
				{ actorIsAdmin: context.user.isAdmin },
				invitationHooks(),
			),
		);
		return { invited: refs.length };
	});

export const resendInvitationServer = protectedActionFn
	.inputValidator(memberIdSchema)
	.handler(async ({ data, context }) => {
		await withDomainErrors(() =>
			resendInvitation(
				data.memberId,
				context.user.id,
				{ actorIsAdmin: context.user.isAdmin },
				invitationHooks(),
			),
		);
		return { ok: true };
	});

export const removeMemberServer = protectedActionFn
	.inputValidator(memberIdSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			removeMember(data.memberId, context.user.id, {
				actorIsAdmin: context.user.isAdmin,
			}),
		),
	);

export const setMemberItemsServer = protectedActionFn
	.inputValidator(setMemberItemsSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			setMemberItems(data.memberId, context.user.id, data.itemIds, {
				actorIsAdmin: context.user.isAdmin,
			}),
		),
	);

export const updateGroupServer = protectedActionFn
	.inputValidator(updateGroupSchema)
	.handler(async ({ data, context }) => {
		const { groupId, ...patch } = data;
		return withDomainErrors(() =>
			updateGroup(groupId, context.user.id, patch, {
				actorIsAdmin: context.user.isAdmin,
			}),
		);
	});

export const closeGroupServer = protectedActionFn
	.inputValidator(groupIdSchema)
	.handler(async ({ data, context }) => {
		await withDomainErrors(() =>
			closeGroup(data.groupId, context.user.id, {
				actorIsAdmin: context.user.isAdmin,
			}),
		);
		return { ok: true };
	});

/** Public: a student joins through the teacher's link. Rate limited and captcha-protected. */
export const joinGroupServer = createServerFn({ method: "POST" })
	.inputValidator(joinGroupSchema)
	.handler(async ({ data }) => {
		const ip = getClientIp(getRequestHeaders());
		await consumeRateLimit(
			"groups:join",
			JOIN_GROUP_LIMIT,
			joinGroupRateKey(ip, data.code),
		);
		await assertTurnstile(
			data.turnstileToken,
			ip === "unknown" ? undefined : ip,
		);
		const ref = await withDomainErrors(() =>
			joinGroup(data.code, data.email, invitationHooks()),
		);
		return { email: ref.email };
	});
