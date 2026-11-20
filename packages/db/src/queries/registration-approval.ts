import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import {
	eventRegistrations,
	eventSeatCounts,
	type RegistrationState,
} from "../schema/event-registrations";
import {
	assertEventOpen,
	notify,
	type RegistrationChange,
	type RegistrationHooks,
} from "./event-registrations";
import { lockEvent } from "./locks";
import { getCurrentTxId } from "./txid";

/** Rows of `eventId` among `ids` that are in one of `states`, oldest request first. */
async function requestsIn(
	tx: TransactionClient,
	eventId: string,
	ids: string[],
	states: RegistrationState[],
): Promise<string[]> {
	if (ids.length === 0) {
		return [];
	}
	const rows = await tx
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				inArray(eventRegistrations.id, ids),
				inArray(eventRegistrations.state, states),
			),
		)
		.orderBy(asc(eventRegistrations.createdAt), asc(eventRegistrations.id));
	return rows.map((row) => row.id);
}

async function setState(
	tx: TransactionClient,
	ids: string[],
	state: RegistrationState,
): Promise<void> {
	if (ids.length > 0) {
		await tx
			.update(eventRegistrations)
			.set({ state })
			.where(inArray(eventRegistrations.id, ids));
	}
}

/**
 * Approves pending (or earlier rejected) requests, oldest first: each takes a
 * free place while there is one, the rest join the waitlist. Other ids are skipped.
 */
export async function approveRegistrations(
	eventId: string,
	registrationIds: string[],
	hooks?: RegistrationHooks,
): Promise<{ approved: number; waitlisted: number; txid: number }> {
	return db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		await assertEventOpen(tx, eventId);
		const requests = await requestsIn(tx, eventId, registrationIds, [
			"pending",
			"rejected",
		]);
		const [count] = await tx
			.select({ seatsRemaining: eventSeatCounts.seatsRemaining })
			.from(eventSeatCounts)
			.where(eq(eventSeatCounts.eventId, eventId));
		const free = Math.max(count?.seatsRemaining ?? 0, 0);
		const placed = requests.slice(0, free);
		const waiting = requests.slice(free);
		await setState(tx, placed, "registered");
		await setState(tx, waiting, "waitlisted");
		const changes: RegistrationChange[] = [
			...placed.map((id) => ({
				registrationId: id,
				change: "confirmed" as const,
			})),
			...waiting.map((id) => ({
				registrationId: id,
				change: "waitlisted" as const,
			})),
		];
		await notify(tx, hooks, changes);
		return {
			approved: placed.length,
			waitlisted: waiting.length,
			txid: await getCurrentTxId(tx),
		};
	});
}

/** Declines pending requests; other ids are skipped. */
export async function rejectRegistrations(
	eventId: string,
	registrationIds: string[],
	hooks?: RegistrationHooks,
): Promise<{ rejected: number; txid: number }> {
	return db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		await assertEventOpen(tx, eventId);
		const requests = await requestsIn(tx, eventId, registrationIds, [
			"pending",
		]);
		await setState(tx, requests, "rejected");
		await notify(
			tx,
			hooks,
			requests.map((id) => ({ registrationId: id, change: "rejected" })),
		);
		return { rejected: requests.length, txid: await getCurrentTxId(tx) };
	});
}
