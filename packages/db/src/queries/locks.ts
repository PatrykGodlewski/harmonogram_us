/**
 * Row locks, always taken in the global order (see CLAUDE.md):
 * events → agenda_items (by id) → registration_groups → registration_group_members → count rows.
 * Inserting a row with a foreign key takes a key-share lock on its parent, so lock parents first.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { TransactionClient } from "../client";
import { agendaItems } from "../schema/agenda";
import { events } from "../schema/events";
import { registrationGroupMembers, registrationGroups } from "../schema/groups";
import { DomainError } from "./domain-errors";

export type LockedGroup = typeof registrationGroups.$inferSelect;
export type LockedMember = typeof registrationGroupMembers.$inferSelect;

export async function lockEvent(
	tx: TransactionClient,
	eventId: string,
): Promise<{ id: string } | null> {
	const [event] = await tx
		.select({ id: events.id })
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

/** Locks a member's group, then the member (group before member). Null if the member doesn't exist. */
export async function lockMemberAndGroup(
	tx: TransactionClient,
	memberWhere: { id: string } | { tokenHash: string },
): Promise<{ member: LockedMember; group: LockedGroup } | null> {
	const condition =
		"id" in memberWhere
			? eq(registrationGroupMembers.id, memberWhere.id)
			: eq(registrationGroupMembers.tokenHash, memberWhere.tokenHash);
	const [peek] = await tx
		.select({ groupId: registrationGroupMembers.groupId })
		.from(registrationGroupMembers)
		.where(condition);
	if (!peek) {
		return null;
	}
	const group = await lockGroup(tx, { id: peek.groupId });
	const [member] = await tx
		.select()
		.from(registrationGroupMembers)
		.where(condition)
		.for("update");
	return member ? { member, group } : null;
}
