import { and, asc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { agendaItems } from "../schema/agenda";
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
import {
	assertEventOpen,
	promoteAndNotify,
	type RegistrationHooks,
} from "./event-registrations";
import {
	type ActorOptions,
	assertGroupAcceptsMembers,
	assertGroupDeadlineOpen,
	assertGroupOwner,
	groupDeadlineColumn,
} from "./group-guards";
import { createJoinCode } from "./group-tokens";
import {
	type LockedGroup,
	lockEvent,
	lockEventAndGroup,
	lockGroup,
	lockMemberAndGroup,
	lockRegistrableItems,
} from "./locks";

export type { ActorOptions } from "./group-guards";

/**
 * A member touched by an invite. `needsEmail` is false for members who already
 * confirmed. Tokens are issued only by the email job (only hashes are stored).
 */
export type GroupMemberRef = {
	memberId: string;
	email: string;
	needsEmail: boolean;
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
	/** The group's default sessions, in agenda order. */
	items: Array<{ id: string; title: string }>;
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
	const toSend = refs.filter((ref) => ref.needsEmail);
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

/** Adds members (or marks existing invited ones as re-invited). Caller holds the group lock. */
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

	const reinvitedIds = emails
		.map((email) => byEmail.get(email))
		.filter((member) => member?.status === "invited")
		.map((member) => member?.id ?? "");
	if (reinvitedIds.length > 0) {
		await tx
			.update(registrationGroupMembers)
			.set({ invitedAt: new Date() })
			.where(inArray(registrationGroupMembers.id, reinvitedIds));
	}

	const inserted =
		newEmails.length > 0
			? await tx
					.insert(registrationGroupMembers)
					.values(
						newEmails.map((email) => ({
							groupId: group.id,
							email,
							invitedVia,
						})),
					)
					.returning({
						id: registrationGroupMembers.id,
						email: registrationGroupMembers.email,
					})
			: [];
	const defaults = await groupItemIds(tx, group.id);
	if (inserted.length > 0 && defaults.length > 0) {
		await tx.insert(registrationGroupMemberItems).values(
			inserted.flatMap((member) =>
				defaults.map((agendaItemId) => ({
					memberId: member.id,
					agendaItemId,
				})),
			),
		);
	}

	const insertedByEmail = new Map(
		inserted.map((member) => [member.email, member.id]),
	);
	return emails.map((email) => {
		const current = byEmail.get(email);
		return current
			? {
					memberId: current.id,
					email,
					needsEmail: current.status === "invited",
				}
			: { memberId: insertedByEmail.get(email) ?? "", email, needsEmail: true };
	});
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
		const locked = await lockMemberAndGroup(tx, { id: memberId });
		if (!locked) {
			throw new DomainError("GROUP_NOT_FOUND");
		}
		const { member, group } = locked;
		assertGroupOwner(group, actorUserId, opts);
		await assertGroupAcceptsMembers(tx, group);
		const ref: GroupMemberRef = {
			memberId: member.id,
			email: member.email,
			needsEmail: member.status === "invited",
		};
		if (ref.needsEmail) {
			await tx
				.update(registrationGroupMembers)
				.set({ invitedAt: new Date() })
				.where(eq(registrationGroupMembers.id, member.id));
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
	hooks?: RegistrationHooks,
): Promise<GroupDetails> {
	try {
		await db.transaction(async (tx) => {
			const group = await lockEventAndGroup(tx, groupId);
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
				// Locks agenda items after the group, against the global order. Safe only because
				// lockEventAndGroup took the event row first: every path that locks items or this
				// group locks the event before them, so no transaction can hold the items and wait
				// for the group.
				await replaceGroupItems(tx, group, patch.itemIds);
			}
			if (patch.places !== undefined && patch.places < group.places) {
				await promoteAndNotify(tx, group.eventId, hooks);
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

	const followers = (await listMembersWithItems(tx, group.id))
		.filter((member) => sameAsPrevious(member.itemIds))
		.map((member) => member.id);
	if (followers.length === 0) {
		return;
	}
	await tx
		.delete(registrationGroupMemberItems)
		.where(inArray(registrationGroupMemberItems.memberId, followers));
	if (next.length > 0) {
		await tx
			.insert(registrationGroupMemberItems)
			.values(
				followers.flatMap((memberId) =>
					next.map((agendaItemId) => ({ memberId, agendaItemId })),
				),
			);
	}
}

type MemberWithItems = typeof registrationGroupMembers.$inferSelect & {
	itemIds: string[];
};

/** A group's members with their item ids, in invitation order (one query). */
async function listMembersWithItems(
	client: DbExecutor,
	groupId: string,
): Promise<MemberWithItems[]> {
	const rows = await client
		.select({
			member: registrationGroupMembers,
			itemId: registrationGroupMemberItems.agendaItemId,
		})
		.from(registrationGroupMembers)
		.leftJoin(
			registrationGroupMemberItems,
			eq(registrationGroupMemberItems.memberId, registrationGroupMembers.id),
		)
		.where(eq(registrationGroupMembers.groupId, groupId))
		.orderBy(asc(registrationGroupMembers.invitedAt));
	const byId = new Map<string, MemberWithItems>();
	for (const { member, itemId } of rows) {
		const entry = byId.get(member.id) ?? { ...member, itemIds: [] };
		if (itemId) {
			entry.itemIds.push(itemId);
		}
		byId.set(member.id, entry);
	}
	return [...byId.values()];
}

export async function closeGroup(
	groupId: string,
	actorUserId: string,
	opts?: ActorOptions,
	hooks?: RegistrationHooks,
): Promise<void> {
	await db.transaction(async (tx) => {
		const group = await lockEventAndGroup(tx, groupId);
		assertGroupOwner(group, actorUserId, opts);
		await tx
			.update(registrationGroups)
			.set({ status: "closed", updatedAt: new Date() })
			.where(eq(registrationGroups.id, groupId));
		await promoteAndNotify(tx, group.eventId, hooks);
	});
}

/** Closes open groups whose deadline has passed. Returns how many were closed. */
export async function closeExpiredGroups(
	now: Date = new Date(),
	hooks?: RegistrationHooks,
): Promise<number> {
	const expired = and(
		eq(registrationGroups.status, "open"),
		sql`group_deadline(${registrationGroups.eventId}) <= ${now.toISOString()}::timestamptz`,
	);
	const eventIds = await db
		.selectDistinct({ eventId: registrationGroups.eventId })
		.from(registrationGroups)
		.where(expired)
		.orderBy(registrationGroups.eventId);
	let closed = 0;
	const failures: unknown[] = [];
	// One transaction per event: lock it, close its expired groups, promote the waitlist.
	// A failing event is retried on the next run; it doesn't hold up the others.
	for (const { eventId } of eventIds) {
		try {
			closed += await db.transaction(async (tx) => {
				await lockEvent(tx, eventId);
				const rows = await tx
					.update(registrationGroups)
					.set({ status: "closed", updatedAt: now })
					.where(and(expired, eq(registrationGroups.eventId, eventId)))
					.returning({ id: registrationGroups.id });
				await promoteAndNotify(tx, eventId, hooks);
				return rows.length;
			});
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length === 1) {
		throw failures[0];
	}
	if (failures.length > 1) {
		throw new AggregateError(
			failures,
			`closing expired groups failed for ${failures.length} events`,
		);
	}
	return closed;
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
	const [[row], items, members] = await Promise.all([
		querySummaries().where(eq(registrationGroups.id, groupId)),
		db
			.select({ id: agendaItems.id, title: agendaItems.title })
			.from(registrationGroupItems)
			.innerJoin(
				agendaItems,
				eq(agendaItems.id, registrationGroupItems.agendaItemId),
			)
			.where(eq(registrationGroupItems.groupId, groupId))
			.orderBy(asc(agendaItems.startsAt)),
		listMembersWithItems(db, groupId),
	]);
	if (!row) {
		throw new DomainError("GROUP_NOT_FOUND");
	}
	assertGroupOwner(row, actorUserId, opts);
	return {
		...toSummary(row),
		joinCode: row.joinCode,
		items,
		itemIds: items.map((item) => item.id),
		members: members.map((member) => ({
			id: member.id,
			email: member.email,
			status: member.status,
			invitedVia: member.invitedVia,
			itemIds: member.itemIds,
			confirmedAt: member.confirmedAt,
		})),
	};
}

/** What anyone with a join link or invitation may see about a group. */
export async function findPublicGroupInfo(
	where: SQL,
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
		.where(where);
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

export function getGroupByJoinCode(
	joinCode: string,
): Promise<PublicGroupInfo | null> {
	return findPublicGroupInfo(eq(registrationGroups.joinCode, joinCode));
}
