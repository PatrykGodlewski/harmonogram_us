import { and, asc, eq, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { authUsers } from "../schema/better-auth";
import { events } from "../schema/events";
import {
	registrationGroupItems,
	registrationGroupMemberItems,
	registrationGroupMembers,
	registrationGroups,
} from "../schema/groups";
import {
	DomainError,
	GROUP_HOLD_ERRORS,
	mapConstraintError,
} from "./domain-errors";
import { assertEventOpen } from "./event-registrations";
import {
	type ActorOptions,
	assertGroupAcceptsMembers,
	assertGroupDeadlineOpen,
	assertGroupOwner,
	groupDeadlineColumn,
} from "./group-guards";
import { createInvitationToken, createJoinCode } from "./group-tokens";
import {
	type LockedGroup,
	lockEvent,
	lockGroup,
	lockRegistrableItems,
} from "./locks";

export type { ActorOptions } from "./group-guards";

/** `token` is null when the member is already confirmed (nothing to send). */
export type GroupMemberRef = {
	memberId: string;
	email: string;
	token: string | null;
};

export type GroupSummary = {
	id: string;
	eventId: string;
	eventTitle: string;
	eventDate: Date;
	name: string | null;
	ownerEmail: string;
	places: number;
	confirmed: number;
	invited: number;
	status: string;
	deadline: Date;
};

export type GroupDetails = GroupSummary & {
	joinCode: string | null;
	itemIds: string[];
	members: Array<{
		id: string;
		email: string;
		status: string;
		invitedVia: string;
		itemIds: string[];
		confirmedAt: Date | null;
	}>;
};

export type PublicGroupInfo = {
	groupId: string;
	eventId: string;
	eventTitle: string;
	eventDate: Date;
	name: string | null;
	ownerName: string | null;
	placesLeft: number;
	status: string;
	deadline: Date;
};

/**
 * Runs inside the group transaction, just before commit. Used to enqueue
 * invitation emails atomically (transactional outbox) without @repo/db
 * depending on the job queue.
 */
export type InvitationHooks = {
	onInvited?: (tx: TransactionClient, refs: GroupMemberRef[]) => Promise<void>;
};

async function runInvitedHook(
	tx: TransactionClient,
	hooks: InvitationHooks | undefined,
	refs: GroupMemberRef[],
) {
	const toSend = refs.filter((ref) => ref.token);
	if (hooks?.onInvited && toSend.length > 0) {
		await hooks.onInvited(tx, toSend);
	}
}

export function normalizeEmails(emails: string[]): string[] {
	return [
		...new Set(
			emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
		),
	];
}

async function groupItemIds(
	tx: DbExecutor,
	groupId: string,
): Promise<string[]> {
	const rows = await tx
		.select({ id: registrationGroupItems.agendaItemId })
		.from(registrationGroupItems)
		.where(eq(registrationGroupItems.groupId, groupId));
	return rows.map((row) => row.id);
}

/**
 * Adds members (or re-issues tokens for existing invited ones). Caller holds the group lock.
 */
async function addMembers(
	tx: TransactionClient,
	group: LockedGroup,
	emails: string[],
	invitedVia: "email" | "link",
): Promise<GroupMemberRef[]> {
	const existing = await tx
		.select({
			id: registrationGroupMembers.id,
			email: registrationGroupMembers.email,
			status: registrationGroupMembers.status,
		})
		.from(registrationGroupMembers)
		.where(eq(registrationGroupMembers.groupId, group.id));
	const byEmail = new Map(existing.map((member) => [member.email, member]));
	const newEmails = emails.filter((email) => !byEmail.has(email));

	if (existing.length + newEmails.length > group.places) {
		throw new DomainError("GROUP_FULL");
	}

	const defaults = await groupItemIds(tx, group.id);
	const refs: GroupMemberRef[] = [];

	for (const email of emails) {
		const current = byEmail.get(email);
		if (current) {
			if (current.status === "confirmed") {
				refs.push({ memberId: current.id, email, token: null });
				continue;
			}
			const { token, tokenHash } = createInvitationToken();
			await tx
				.update(registrationGroupMembers)
				.set({ tokenHash, invitedAt: new Date() })
				.where(eq(registrationGroupMembers.id, current.id));
			refs.push({ memberId: current.id, email, token });
			continue;
		}

		const { token, tokenHash } = createInvitationToken();
		const [inserted] = await tx
			.insert(registrationGroupMembers)
			.values({ groupId: group.id, email, invitedVia, tokenHash })
			.returning({ id: registrationGroupMembers.id });
		if (!inserted) {
			throw new Error("Member insert failed");
		}
		if (defaults.length > 0) {
			await tx.insert(registrationGroupMemberItems).values(
				defaults.map((agendaItemId) => ({
					memberId: inserted.id,
					agendaItemId,
				})),
			);
		}
		refs.push({ memberId: inserted.id, email, token });
	}
	return refs;
}

export async function createGroup(
	input: {
		eventId: string;
		ownerUserId: string;
		places: number;
		itemIds: string[];
		name?: string | null;
		emails: string[];
		joinLinkEnabled: boolean;
	},
	hooks?: InvitationHooks,
): Promise<{
	groupId: string;
	joinCode: string | null;
	invited: GroupMemberRef[];
}> {
	const emails = normalizeEmails(input.emails);
	try {
		return await db.transaction(async (tx) => {
			const [owner] = await tx
				.select({ emailVerified: authUsers.emailVerified })
				.from(authUsers)
				.where(eq(authUsers.id, input.ownerUserId));
			if (!owner?.emailVerified) {
				throw new DomainError("EMAIL_NOT_VERIFIED");
			}

			if (!(await lockEvent(tx, input.eventId))) {
				throw new DomainError("EVENT_NOT_FOUND");
			}
			await assertEventOpen(tx, input.eventId);
			await assertGroupDeadlineOpen(tx, input.eventId);
			const itemIds = await lockRegistrableItems(
				tx,
				input.eventId,
				input.itemIds,
			);

			if (emails.length > input.places) {
				throw new DomainError("GROUP_FULL");
			}

			const [group] = await tx
				.insert(registrationGroups)
				.values({
					eventId: input.eventId,
					ownerUserId: input.ownerUserId,
					name: input.name?.trim() || null,
					places: input.places,
					joinCode: input.joinLinkEnabled ? createJoinCode() : null,
				})
				.returning();
			if (!group) {
				throw new Error("Group insert failed");
			}
			if (itemIds.length > 0) {
				await tx.insert(registrationGroupItems).values(
					itemIds.map((agendaItemId) => ({
						groupId: group.id,
						agendaItemId,
					})),
				);
			}
			const invited = await addMembers(tx, group, emails, "email");
			await runInvitedHook(tx, hooks, invited);
			return { groupId: group.id, joinCode: group.joinCode, invited };
		});
	} catch (error) {
		mapConstraintError(error, GROUP_HOLD_ERRORS);
	}
}

export async function inviteToGroup(
	groupId: string,
	actorUserId: string,
	emails: string[],
	opts?: ActorOptions,
	hooks?: InvitationHooks,
): Promise<GroupMemberRef[]> {
	try {
		return await db.transaction(async (tx) => {
			const group = await lockGroup(tx, { id: groupId });
			assertGroupOwner(group, actorUserId, opts);
			await assertGroupAcceptsMembers(tx, group);
			const refs = await addMembers(
				tx,
				group,
				normalizeEmails(emails),
				"email",
			);
			await runInvitedHook(tx, hooks, refs);
			return refs;
		});
	} catch (error) {
		mapConstraintError(error, GROUP_HOLD_ERRORS);
	}
}

export async function joinGroup(
	joinCode: string,
	email: string,
	hooks?: InvitationHooks,
): Promise<GroupMemberRef> {
	try {
		return await db.transaction(async (tx) => {
			const group = await lockGroup(tx, { joinCode });
			await assertGroupAcceptsMembers(tx, group);
			const [ref] = await addMembers(
				tx,
				group,
				normalizeEmails([email]),
				"link",
			);
			if (!ref) {
				throw new DomainError("INVITATION_INVALID");
			}
			await runInvitedHook(tx, hooks, [ref]);
			return ref;
		});
	} catch (error) {
		mapConstraintError(error, GROUP_HOLD_ERRORS);
	}
}

export async function resendInvitation(
	memberId: string,
	actorUserId: string,
	opts?: ActorOptions,
	hooks?: InvitationHooks,
): Promise<GroupMemberRef> {
	return db.transaction(async (tx) => {
		const [member] = await tx
			.select({
				groupId: registrationGroupMembers.groupId,
				email: registrationGroupMembers.email,
			})
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.id, memberId));
		if (!member) {
			throw new DomainError("GROUP_NOT_FOUND");
		}
		const group = await lockGroup(tx, { id: member.groupId });
		assertGroupOwner(group, actorUserId, opts);
		await assertGroupAcceptsMembers(tx, group);
		const [ref] = await addMembers(tx, group, [member.email], "email");
		if (!ref) {
			throw new DomainError("INVITATION_INVALID");
		}
		await runInvitedHook(tx, hooks, [ref]);
		return ref;
	});
}

export async function updateGroup(
	groupId: string,
	actorUserId: string,
	patch: {
		places?: number;
		name?: string | null;
		itemIds?: string[];
		joinLink?: "enable" | "disable" | "regenerate";
	},
	opts?: ActorOptions,
): Promise<GroupDetails> {
	try {
		await db.transaction(async (tx) => {
			const group = await lockGroup(tx, { id: groupId });
			assertGroupOwner(group, actorUserId, opts);

			const values: Partial<typeof registrationGroups.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (patch.places !== undefined) {
				const [count] = await tx
					.select({ n: sql<number>`count(*)::int` })
					.from(registrationGroupMembers)
					.where(eq(registrationGroupMembers.groupId, groupId));
				if ((count?.n ?? 0) > patch.places) {
					throw new DomainError("GROUP_FULL");
				}
				values.places = patch.places;
			}
			if (patch.name !== undefined) {
				values.name = patch.name?.trim() || null;
			}
			if (patch.joinLink === "disable") {
				values.joinCode = null;
			} else if (
				patch.joinLink === "regenerate" ||
				(patch.joinLink === "enable" && !group.joinCode)
			) {
				values.joinCode = createJoinCode();
			}
			await tx
				.update(registrationGroups)
				.set(values)
				.where(eq(registrationGroups.id, groupId));

			if (patch.itemIds) {
				await replaceGroupItems(tx, group, patch.itemIds);
			}
		});
	} catch (error) {
		mapConstraintError(error, GROUP_HOLD_ERRORS);
	}
	return getGroupDetails(groupId, actorUserId, opts);
}

/** New defaults also apply to members whose items matched the old defaults. */
async function replaceGroupItems(
	tx: TransactionClient,
	group: LockedGroup,
	itemIds: string[],
) {
	const next = await lockRegistrableItems(tx, group.eventId, itemIds);
	const previous = (await groupItemIds(tx, group.id)).sort();
	const sameAsPrevious = (ids: string[]) =>
		ids.length === previous.length &&
		[...ids].sort().every((id, i) => id === previous[i]);

	await tx
		.delete(registrationGroupItems)
		.where(eq(registrationGroupItems.groupId, group.id));
	if (next.length > 0) {
		await tx
			.insert(registrationGroupItems)
			.values(
				next.map((agendaItemId) => ({ groupId: group.id, agendaItemId })),
			);
	}

	const members = await memberItemMap(tx, group.id);
	for (const [memberId, ids] of members) {
		if (!sameAsPrevious(ids)) {
			continue;
		}
		await tx
			.delete(registrationGroupMemberItems)
			.where(eq(registrationGroupMemberItems.memberId, memberId));
		if (next.length > 0) {
			await tx
				.insert(registrationGroupMemberItems)
				.values(next.map((agendaItemId) => ({ memberId, agendaItemId })));
		}
	}
}

async function memberItemMap(
	client: DbExecutor,
	groupId: string,
): Promise<Map<string, string[]>> {
	const rows = await client
		.select({
			memberId: registrationGroupMembers.id,
			itemId: registrationGroupMemberItems.agendaItemId,
		})
		.from(registrationGroupMembers)
		.leftJoin(
			registrationGroupMemberItems,
			eq(registrationGroupMemberItems.memberId, registrationGroupMembers.id),
		)
		.where(eq(registrationGroupMembers.groupId, groupId));
	const map = new Map<string, string[]>();
	for (const row of rows) {
		const list = map.get(row.memberId) ?? [];
		if (row.itemId) {
			list.push(row.itemId);
		}
		map.set(row.memberId, list);
	}
	return map;
}

export async function closeGroup(
	groupId: string,
	actorUserId: string,
	opts?: ActorOptions,
): Promise<void> {
	await db.transaction(async (tx) => {
		const group = await lockGroup(tx, { id: groupId });
		assertGroupOwner(group, actorUserId, opts);
		await tx
			.update(registrationGroups)
			.set({ status: "closed", updatedAt: new Date() })
			.where(eq(registrationGroups.id, groupId));
	});
}

/** Closes open groups whose deadline has passed. Returns how many were closed. */
export async function closeExpiredGroups(
	now: Date = new Date(),
): Promise<number> {
	const closed = await db
		.update(registrationGroups)
		.set({ status: "closed", updatedAt: now })
		.where(
			and(
				eq(registrationGroups.status, "open"),
				sql`group_deadline(${registrationGroups.eventId}) <= ${now.toISOString()}::timestamptz`,
			),
		)
		.returning({ id: registrationGroups.id });
	return closed.length;
}

function summarySelect() {
	return {
		id: registrationGroups.id,
		eventId: registrationGroups.eventId,
		eventTitle: events.title,
		eventDate: events.date,
		name: registrationGroups.name,
		ownerEmail: authUsers.email,
		ownerUserId: registrationGroups.ownerUserId,
		places: registrationGroups.places,
		status: registrationGroups.status,
		joinCode: registrationGroups.joinCode,
		confirmed: sql<number>`(SELECT count(*)::int FROM registration_group_members m WHERE m.group_id = ${registrationGroups.id} AND m.status = 'confirmed')`,
		invited: sql<number>`(SELECT count(*)::int FROM registration_group_members m WHERE m.group_id = ${registrationGroups.id} AND m.status = 'invited')`,
		deadline: groupDeadlineColumn(registrationGroups.eventId),
	};
}

function querySummaries() {
	return db
		.select(summarySelect())
		.from(registrationGroups)
		.innerJoin(events, eq(events.id, registrationGroups.eventId))
		.innerJoin(authUsers, eq(authUsers.id, registrationGroups.ownerUserId));
}

type SummaryRow = Awaited<ReturnType<typeof querySummaries>>[number];

function toSummary(row: SummaryRow): GroupSummary {
	return {
		id: row.id,
		eventId: row.eventId,
		eventTitle: row.eventTitle,
		eventDate: row.eventDate,
		name: row.name,
		ownerEmail: row.ownerEmail,
		places: row.places,
		confirmed: row.confirmed,
		invited: row.invited,
		status: row.status,
		deadline: new Date(row.deadline),
	};
}

export async function listGroupsForEvent(
	eventId: string,
): Promise<GroupSummary[]> {
	const rows = await querySummaries()
		.where(eq(registrationGroups.eventId, eventId))
		.orderBy(asc(registrationGroups.createdAt));
	return rows.map(toSummary);
}

export async function listMyGroups(userId: string): Promise<GroupSummary[]> {
	const rows = await querySummaries()
		.where(eq(registrationGroups.ownerUserId, userId))
		.orderBy(asc(events.date));
	return rows.map(toSummary);
}

export async function getGroupDetails(
	groupId: string,
	actorUserId: string,
	opts?: ActorOptions,
): Promise<GroupDetails> {
	const [row] = await querySummaries().where(
		eq(registrationGroups.id, groupId),
	);
	if (!row) {
		throw new DomainError("GROUP_NOT_FOUND");
	}
	if (row.ownerUserId !== actorUserId && !opts?.actorIsAdmin) {
		throw new DomainError("NOT_GROUP_OWNER");
	}
	const [itemIds, items, members] = await Promise.all([
		groupItemIds(db, groupId),
		memberItemMap(db, groupId),
		db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.groupId, groupId))
			.orderBy(asc(registrationGroupMembers.invitedAt)),
	]);
	return {
		...toSummary(row),
		joinCode: row.joinCode,
		itemIds,
		members: members.map((member) => ({
			id: member.id,
			email: member.email,
			status: member.status,
			invitedVia: member.invitedVia,
			itemIds: items.get(member.id) ?? [],
			confirmedAt: member.confirmedAt,
		})),
	};
}

export async function getGroupByJoinCode(
	joinCode: string,
): Promise<PublicGroupInfo | null> {
	const [row] = await db
		.select({
			...summarySelect(),
			ownerName: authUsers.name,
			members: sql<number>`(SELECT count(*)::int FROM registration_group_members m WHERE m.group_id = ${registrationGroups.id})`,
		})
		.from(registrationGroups)
		.innerJoin(events, eq(events.id, registrationGroups.eventId))
		.innerJoin(authUsers, eq(authUsers.id, registrationGroups.ownerUserId))
		.where(eq(registrationGroups.joinCode, joinCode));
	if (!row) {
		return null;
	}
	return {
		groupId: row.id,
		eventId: row.eventId,
		eventTitle: row.eventTitle,
		eventDate: row.eventDate,
		name: row.name,
		ownerName: row.ownerName,
		placesLeft: Math.max(0, row.places - row.members),
		status: row.status,
		deadline: new Date(row.deadline),
	};
}
