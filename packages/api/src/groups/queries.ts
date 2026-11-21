import { getInvitation } from "@repo/db/queries/group-members";
import {
	getGroupByJoinCode,
	getGroupDetails,
	listMyGroups,
} from "@repo/db/queries/groups";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "../auth/middleware";
import { appError, withDomainErrors } from "../errors";
import {
	groupIdSchema,
	invitationTokenSchema,
	joinCodeSchema,
} from "./schemas";

export type { InvitationView } from "@repo/db/queries/group-members";
export type {
	GroupDetails,
	GroupSummary,
	PublicGroupInfo,
} from "@repo/db/queries/groups";

const protectedQueryFn = createServerFn({ method: "GET" }).middleware([
	authMiddleware,
]);

export const fetchMyGroupsServer = protectedQueryFn.handler(
	async ({ context }) => listMyGroups(context.user.id),
);

export const myGroupsQueryOptions = queryOptions({
	queryKey: ["my-groups"] as const,
	queryFn: () => fetchMyGroupsServer(),
});

export const fetchGroupDetailsServer = protectedQueryFn
	.validator(groupIdSchema)
	.handler(async ({ data, context }) =>
		withDomainErrors(() =>
			getGroupDetails(data.groupId, context.user.id, {
				actorIsAdmin: context.user.isAdmin,
			}),
		),
	);

export const groupDetailsQueryOptions = (groupId: string) =>
	queryOptions({
		queryKey: ["group", groupId] as const,
		queryFn: () => fetchGroupDetailsServer({ data: { groupId } }),
	});

/** Public: what a join link shows before anyone signs in. */
export const fetchJoinGroupInfoServer = createServerFn({ method: "GET" })
	.validator(joinCodeSchema)
	.handler(async ({ data }) => {
		const info = await getGroupByJoinCode(data.code);
		if (!info) {
			throw appError("GROUP_NOT_FOUND");
		}
		return info;
	});

export const joinGroupInfoQueryOptions = (code: string) =>
	queryOptions({
		queryKey: ["join-group", code] as const,
		queryFn: () => fetchJoinGroupInfoServer({ data: { code } }),
	});

/** Public and read-only: the confirm page for an emailed invitation (safe for link scanners). */
export const fetchInvitationServer = createServerFn({ method: "GET" })
	.validator(invitationTokenSchema)
	.handler(async ({ data }) => {
		const invitation = await getInvitation(data.token);
		if (!invitation) {
			throw appError("INVITATION_INVALID");
		}
		return invitation;
	});

export const invitationQueryOptions = (token: string) =>
	queryOptions({
		queryKey: ["invitation", token] as const,
		queryFn: () => fetchInvitationServer({ data: { token } }),
		staleTime: 0,
	});
