import { type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DbExecutor, TransactionClient } from "../client";
import { DomainError } from "./domain-errors";
import type { LockedGroup } from "./locks";

/** Lets an admin act on any group; owners act on their own. */
export type ActorOptions = { actorIsAdmin?: boolean };

/** SQL column: the event's group deadline as text (single definition of the rule: migration 0008). */
export function groupDeadlineColumn(eventId: AnyPgColumn | SQL): SQL<string> {
	return sql<string>`group_deadline(${eventId})::text`;
}

export async function groupDeadline(
	client: DbExecutor,
	eventId: string,
): Promise<Date> {
	const [row] = await client.execute<{ deadline: string }>(
		sql`SELECT group_deadline(${eventId})::text AS deadline`,
	);
	return new Date(row?.deadline ?? 0);
}

export async function isGroupDeadlinePassed(
	client: DbExecutor,
	eventId: string,
): Promise<boolean> {
	return (await groupDeadline(client, eventId)).getTime() <= Date.now();
}

export async function assertGroupDeadlineOpen(
	tx: TransactionClient,
	eventId: string,
): Promise<void> {
	if (await isGroupDeadlinePassed(tx, eventId)) {
		throw new DomainError("GROUP_DEADLINE_PASSED");
	}
}

export function assertGroupOwner(
	group: Pick<LockedGroup, "ownerUserId">,
	actorUserId: string,
	opts?: ActorOptions,
): void {
	if (group.ownerUserId !== actorUserId && !opts?.actorIsAdmin) {
		throw new DomainError("NOT_GROUP_OWNER");
	}
}

/** Open and before the deadline. */
export async function assertGroupAcceptsMembers(
	tx: TransactionClient,
	group: LockedGroup,
): Promise<void> {
	if (group.status !== "open") {
		throw new DomainError("GROUP_CLOSED");
	}
	await assertGroupDeadlineOpen(tx, group.eventId);
}
