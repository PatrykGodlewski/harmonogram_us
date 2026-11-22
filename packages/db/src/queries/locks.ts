/**
 * Row locks, always taken in the global order (see CLAUDE.md):
 * events → agenda_items (by id) → registration_groups → registration_group_members → count rows.
 * Inserting a row with a foreign key takes a key-share lock on its parent, so lock parents first.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { TransactionClient } from "../client";
import { agendaItems } from "../schema/agenda";
import { type EventStatus, events } from "../schema/events";
import { registrationGroupMembers, registrationGroups } from "../schema/groups";
import { DomainError } from "./domain-errors";

export type LockedGroup = typeof registrationGroups.$inferSelect;
export type LockedMember = typeof registrationGroupMembers.$inferSelect;

export async function lockEvent(
	tx: TransactionClient,
	eventId: string,
): Promise<{ id: string; status: EventStatus } | null> {
	const [event] = await tx
		.select({ id: events.id, status: events.status })
		.from(events)
		.where(eq(events.id, eventId))
		.for("update");
	return event ?? null;
}

/** Locks the event's registrable items in id order; throws ITEM_NOT_FOUND if any id doesn't qualify. */
export async function lockRegistrableItems(
	tx: TransactionClient,
	eventId: string,
	itemIds: string[],
): Promise<string[]> {
	const unique = [...new Set(itemIds)].sort();
	if (unique.length === 0) {
		return [];
	}
	const rows = await tx
		.select({ id: agendaItems.id })
		.from(agendaItems)
		.where(
			and(
				inArray(agendaItems.id, unique),
				eq(agendaItems.eventId, eventId),
				eq(agendaItems.requiresRegistration, true),
			),
		)
		.orderBy(asc(agendaItems.id))
		.for("update");
	if (rows.length !== unique.length) {
		throw new DomainError("ITEM_NOT_FOUND");
	}
	return unique;
}

export async function lockGroup(
	tx: TransactionClient,
	where: { id: string } | { joinCode: string },
): Promise<LockedGroup> {
	const [group] = await tx
		.select()
		.from(registrationGroups)
		.where(
			"id" in where
				? eq(registrationGroups.id, where.id)
				: eq(registrationGroups.joinCode, where.joinCode),
		)
		.for("update");
	if (!group) {
		throw new DomainError("GROUP_NOT_FOUND");
	}
	return group;
}

/** Locks the group's event, then the group (global lock order). */
export async function lockEventAndGroup(
	tx: TransactionClient,
	groupId: string,
): Promise<LockedGroup> {
	const [peek] = await tx
		.select({ eventId: registrationGroups.eventId })
		.from(registrationGroups)
		.where(eq(registrationGroups.id, groupId));
	if (!peek) {
		throw new DomainError("GROUP_NOT_FOUND");
	}
	await lockEvent(tx, peek.eventId);
	return lockGroup(tx, { id: groupId });
}

type MemberWhere = { id: string } | { tokenHash: string };

function memberCondition(where: MemberWhere) {
	return "id" in where
		? eq(registrationGroupMembers.id, where.id)
		: eq(registrationGroupMembers.tokenHash, where.tokenHash);
}

async function lockMemberOfGroup(
	tx: TransactionClient,
	groupId: string,
	where: MemberWhere,
): Promise<{ member: LockedMember; group: LockedGroup } | null> {
	const group = await lockGroup(tx, { id: groupId });
	const [member] = await tx
		.select()
		.from(registrationGroupMembers)
		.where(memberCondition(where))
		.for("update");
	return member ? { member, group } : null;
}

/** Locks a member's group, then the member (group before member). Null if the member doesn't exist. */
export async function lockMemberAndGroup(
	tx: TransactionClient,
	where: MemberWhere,
): Promise<{ member: LockedMember; group: LockedGroup } | null> {
	const [peek] = await tx
		.select({ groupId: registrationGroupMembers.groupId })
		.from(registrationGroupMembers)
		.where(memberCondition(where));
	return peek ? lockMemberOfGroup(tx, peek.groupId, where) : null;
}

/**
 * Locks the member's event, then its group, then the member (global lock order). Use it
 * when the change can free or take places, so the waitlist can be promoted in the same
 * transaction. Null if the member doesn't exist.
 */
export async function lockEventMemberAndGroup(
	tx: TransactionClient,
	where: MemberWhere,
): Promise<{ member: LockedMember; group: LockedGroup } | null> {
	const [peek] = await tx
		.select({
			groupId: registrationGroupMembers.groupId,
			eventId: registrationGroups.eventId,
		})
		.from(registrationGroupMembers)
		.innerJoin(
			registrationGroups,
			eq(registrationGroups.id, registrationGroupMembers.groupId),
		)
		.where(memberCondition(where));
	if (!peek) {
		return null;
	}
	await lockEvent(tx, peek.eventId);
	return lockMemberOfGroup(tx, peek.groupId, where);
}
