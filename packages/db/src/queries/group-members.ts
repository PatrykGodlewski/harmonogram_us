import { and, eq, gt, inArray } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import { eventRegistrations } from "../schema/event-registrations";
import {
	registrationGroupItems,
	registrationGroupMemberItems,
	registrationGroupMembers,
	registrationGroups,
} from "../schema/groups";
import {
	DomainError,
	mapConstraintError,
	REGISTRATION_ERRORS,
} from "./domain-errors";
import {
	type ActorOptions,
	assertGroupOwner,
	isGroupDeadlinePassed,
} from "./group-guards";
import { createInvitationToken, hashToken } from "./group-tokens";
import { findPublicGroupInfo, type PublicGroupInfo } from "./groups";
import { lockEvent, lockMemberAndGroup } from "./locks";
import { getCurrentTxId } from "./txid";

async function memberItemIds(
	tx: DbExecutor,
	memberId: string,
): Promise<string[]> {
	const rows = await tx
		.select({ id: registrationGroupMemberItems.agendaItemId })
		.from(registrationGroupMemberItems)
		.where(eq(registrationGroupMemberItems.memberId, memberId));
	return rows.map((row) => row.id);
}

/** An emailed invitation (always pending: tokens are cleared once used). */
export type InvitationView = {
	memberId: string;
	email: string;
	group: PublicGroupInfo;
	itemTitles: string[];
};

/** Read-only view for the confirm page (safe for link scanners). */
export async function getInvitation(
	token: string,
): Promise<InvitationView | null> {
	const [member] = await db
		.select({
			id: registrationGroupMembers.id,
			email: registrationGroupMembers.email,
			groupId: registrationGroupMembers.groupId,
		})
		.from(registrationGroupMembers)
		.where(eq(registrationGroupMembers.tokenHash, hashToken(token)));
	if (!member) {
		return null;
	}
	const [group, items] = await Promise.all([
		findPublicGroupInfo(eq(registrationGroups.id, member.groupId)),
		db
			.select({ title: agendaItems.title })
			.from(registrationGroupMemberItems)
			.innerJoin(
				agendaItems,
				eq(agendaItems.id, registrationGroupMemberItems.agendaItemId),
			)
			.where(eq(registrationGroupMemberItems.memberId, member.id))
			.orderBy(agendaItems.startsAt),
	]);
	if (!group) {
		return null;
	}
	return {
		memberId: member.id,
		email: member.email,
		group,
		itemTitles: items.map((item) => item.title),
	};
}

export async function acceptInvitation(
	token: string,
	userId: string,
): Promise<{ eventId: string; txid: number }> {
	try {
		return await db.transaction(async (tx) => {
			const tokenHash = hashToken(token);
			// Global lock order: event first, then group and member.
			const [target] = await tx
				.select({ eventId: registrationGroups.eventId })
				.from(registrationGroupMembers)
				.innerJoin(
					registrationGroups,
					eq(registrationGroups.id, registrationGroupMembers.groupId),
				)
				.where(eq(registrationGroupMembers.tokenHash, tokenHash));
			if (!target) {
				throw new DomainError("INVITATION_INVALID");
			}
			await lockEvent(tx, target.eventId);
			const locked = await lockMemberAndGroup(tx, { tokenHash });
			if (!locked || locked.member.status !== "invited") {
				throw new DomainError("INVITATION_INVALID");
			}
			const { member, group } = locked;
			if (group.status !== "open") {
				throw new DomainError("GROUP_CLOSED");
			}
			if (await isGroupDeadlinePassed(tx, group.eventId)) {
				throw new DomainError("GROUP_DEADLINE_PASSED");
			}

			// Confirm first so the held place is released before the registration takes it.
			await tx
				.update(registrationGroupMembers)
				.set({
					status: "confirmed",
					userId,
					confirmedAt: new Date(),
					tokenHash: null,
				})
				.where(eq(registrationGroupMembers.id, member.id));

			const [existing] = await tx
				.select({
					id: eventRegistrations.id,
					groupId: eventRegistrations.groupId,
				})
				.from(eventRegistrations)
				.where(
					and(
						eq(eventRegistrations.eventId, group.eventId),
						eq(eventRegistrations.userId, userId),
					),
				);
			let eventRegistrationId = existing?.id;
			if (existing) {
				// A waitlisted student takes the group's place instead.
				await tx
					.update(eventRegistrations)
					.set({ groupId: existing.groupId ?? group.id, state: "registered" })
					.where(eq(eventRegistrations.id, existing.id));
			}
			if (!eventRegistrationId) {
				eventRegistrationId = crypto.randomUUID();
				await tx.insert(eventRegistrations).values({
					id: eventRegistrationId,
					eventId: group.eventId,
					userId,
					groupId: group.id,
				});
			}
			await tx
				.update(registrationGroupMembers)
				.set({ eventRegistrationId })
				.where(eq(registrationGroupMembers.id, member.id));

			await addItemRegistrations(
				tx,
				userId,
				eventRegistrationId,
				await memberItemIds(tx, member.id),
			);

			return { eventId: group.eventId, txid: await getCurrentTxId(tx) };
		});
	} catch (error) {
		mapConstraintError(error, REGISTRATION_ERRORS);
	}
}

/** Registers the user for the items that still need registration and haven't ended; skips existing ones. */
async function addItemRegistrations(
	tx: TransactionClient,
	userId: string,
	eventRegistrationId: string,
	itemIds: string[],
) {
	if (itemIds.length === 0) {
		return;
	}
	const open = await tx
		.select({ id: agendaItems.id })
		.from(agendaItems)
		.where(
			and(
				inArray(agendaItems.id, itemIds),
				eq(agendaItems.requiresRegistration, true),
				gt(agendaItems.endsAt, new Date()),
			),
		);
	if (open.length === 0) {
		return;
	}
	await tx
		.insert(agendaItemRegistrations)
		.values(
			open.map((item) => ({
				id: crypto.randomUUID(),
				agendaItemId: item.id,
				eventRegistrationId,
				userId,
			})),
		)
		.onConflictDoNothing({
			target: [
				agendaItemRegistrations.agendaItemId,
				agendaItemRegistrations.userId,
			],
		});
}

export async function removeMember(
	memberId: string,
	actorUserId: string,
	opts?: ActorOptions,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		const locked = await lockMemberAndGroup(tx, { id: memberId });
		if (!locked) {
			throw new DomainError("GROUP_NOT_FOUND");
		}
		assertGroupOwner(locked.group, actorUserId, opts);
		if (locked.member.eventRegistrationId) {
			// Cascades to the member row and the student's item registrations.
			await tx
				.delete(eventRegistrations)
				.where(eq(eventRegistrations.id, locked.member.eventRegistrationId));
		} else {
			await tx
				.delete(registrationGroupMembers)
				.where(eq(registrationGroupMembers.id, memberId));
		}
		return { txid: await getCurrentTxId(tx) };
	});
}

export async function setMemberItems(
	memberId: string,
	actorUserId: string,
	itemIds: string[],
	opts?: ActorOptions,
): Promise<{ txid: number }> {
	const next = [...new Set(itemIds)];
	try {
		return await db.transaction(async (tx) => {
			const locked = await lockMemberAndGroup(tx, { id: memberId });
			if (!locked) {
				throw new DomainError("GROUP_NOT_FOUND");
			}
			const { member, group } = locked;
			assertGroupOwner(group, actorUserId, opts);

			const allowed = new Set(
				(
					await tx
						.select({ id: registrationGroupItems.agendaItemId })
						.from(registrationGroupItems)
						.where(eq(registrationGroupItems.groupId, group.id))
				).map((row) => row.id),
			);
			if (next.some((id) => !allowed.has(id))) {
				throw new DomainError("ITEM_NOT_IN_GROUP");
			}

			const previous = await memberItemIds(tx, member.id);
			const removed = previous.filter((id) => !next.includes(id));
			const added = next.filter((id) => !previous.includes(id));

			if (removed.length > 0) {
				await tx
					.delete(registrationGroupMemberItems)
					.where(
						and(
							eq(registrationGroupMemberItems.memberId, member.id),
							inArray(registrationGroupMemberItems.agendaItemId, removed),
						),
					);
			}
			if (added.length > 0) {
				await tx.insert(registrationGroupMemberItems).values(
					added.map((agendaItemId) => ({
						memberId: member.id,
						agendaItemId,
					})),
				);
			}

			if (
				member.status === "confirmed" &&
				member.userId &&
				member.eventRegistrationId
			) {
				if (removed.length > 0) {
					await tx
						.delete(agendaItemRegistrations)
						.where(
							and(
								eq(agendaItemRegistrations.userId, member.userId),
								inArray(agendaItemRegistrations.agendaItemId, removed),
							),
						);
				}
				await addItemRegistrations(
					tx,
					member.userId,
					member.eventRegistrationId,
					added,
				);
			}
			return { txid: await getCurrentTxId(tx) };
		});
	} catch (error) {
		mapConstraintError(error, REGISTRATION_ERRORS);
	}
}

/**
 * New token for an invited member of an open group before its deadline; null otherwise.
 * The previous token stops working. Used by the email job (only hashes are stored).
 */
export async function reissueInvitationToken(
	memberId: string,
): Promise<string | null> {
	return db.transaction(async (tx) => {
		const locked = await lockMemberAndGroup(tx, { id: memberId });
		if (
			!locked ||
			locked.member.status !== "invited" ||
			locked.group.status !== "open" ||
			(await isGroupDeadlinePassed(tx, locked.group.eventId))
		) {
			return null;
		}
		const { token, tokenHash } = createInvitationToken();
		await tx
			.update(registrationGroupMembers)
			.set({ tokenHash })
			.where(eq(registrationGroupMembers.id, memberId));
		return token;
	});
}
