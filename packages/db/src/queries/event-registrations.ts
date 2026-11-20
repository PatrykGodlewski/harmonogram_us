import { and, asc, eq, inArray, max, type SQL, sql } from "drizzle-orm";
import { type DbExecutor, db, type TransactionClient } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import { authUsers } from "../schema/better-auth";
import {
	eventRegistrations,
	eventSeatCounts,
	type RegistrationState,
} from "../schema/event-registrations";
import { type EventStatus, events } from "../schema/events";
import { registrationGroups } from "../schema/groups";
import {
	DomainError,
	mapConstraintError,
	REGISTRATION_ERRORS,
} from "./domain-errors";
import { lockEvent } from "./locks";
import { getCurrentTxId } from "./txid";
import { findAccountByEmail } from "./users";

/**
 * SQL for an event's effective end (same rule as getEffectiveEventEnd), for queries that
 * list many events. `eventsRef` is how the query refers to the events table (e.g. sql\`e\`).
 */
export function effectiveEventEndSql(eventsRef: SQL): SQL<string> {
	return sql<string>`coalesce(
		${eventsRef}.ends_at,
		(SELECT max(a.ends_at) FROM agenda_items a WHERE a.event_id = ${eventsRef}.id),
		${eventsRef}.date + interval '1 day'
	)`;
}

export async function getEffectiveEventEnd(
	tx: DbExecutor,
	eventId: string,
): Promise<Date | null> {
	const [row] = await tx
		.select({
			endsAt: events.endsAt,
			date: events.date,
			lastItemEnd: max(agendaItems.endsAt),
		})
		.from(events)
		.leftJoin(agendaItems, eq(agendaItems.eventId, events.id))
		.where(eq(events.id, eventId))
		.groupBy(events.id);

	if (!row) {
		return null;
	}
	if (row.endsAt) {
		return row.endsAt;
	}
	if (row.lastItemEnd) {
		return new Date(row.lastItemEnd);
	}
	return new Date(row.date.getTime() + 24 * 60 * 60 * 1000);
}

export async function hasEventEnded(
	tx: DbExecutor,
	eventId: string,
): Promise<boolean> {
	const end = await getEffectiveEventEnd(tx, eventId);
	return end !== null && end.getTime() <= Date.now();
}

/** Registration actions need a published event that hasn't ended (a draft is "not found"). */
export async function assertEventOpen(tx: TransactionClient, eventId: string) {
	const [event] = await tx
		.select({ status: events.status })
		.from(events)
		.where(eq(events.id, eventId));
	if (!event || event.status === "draft") {
		throw new DomainError("EVENT_NOT_FOUND");
	}
	if (event.status === "cancelled") {
		throw new DomainError("EVENT_CANCELLED");
	}
	if (await hasEventEnded(tx, eventId)) {
		throw new DomainError("EVENT_ENDED");
	}
}

export type RegistrationChange = {
	registrationId: string;
	change:
		| "confirmed"
		| "waitlisted"
		| "promoted"
		| "cancelled"
		| "pending"
		| "rejected";
};

/** Where and when an event takes place, as people read it ("Aula · B105"). */
export type EventWhenWhere = { date: Date; place: string | null };

/** A published event's date or place changed: who to tell, and what it was and is. */
export type EventChangeNotice = {
	eventId: string;
	registrationIds: string[];
	before: EventWhenWhere;
	after: EventWhenWhere;
};

/** Called inside the transaction with every registration whose state was set or changed. */
export type RegistrationHooks = {
	onChanged(
		tx: TransactionClient,
		changes: RegistrationChange[],
	): Promise<void>;
	/** A published event moved in time or place (registered and waitlisted people). */
	onEventChanged?(
		tx: TransactionClient,
		notice: EventChangeNotice,
	): Promise<void>;
};

/** Reports registration changes to the hooks, if any changed. */
export async function notify(
	tx: TransactionClient,
	hooks: RegistrationHooks | undefined,
	changes: RegistrationChange[],
): Promise<void> {
	if (hooks && changes.length > 0) {
		await hooks.onChanged(tx, changes);
	}
}

async function seatsRemaining(
	tx: TransactionClient,
	eventId: string,
): Promise<number> {
	const [row] = await tx
		.select({ seatsRemaining: eventSeatCounts.seatsRemaining })
		.from(eventSeatCounts)
		.where(eq(eventSeatCounts.eventId, eventId));
	return row?.seatsRemaining ?? 0;
}

/**
 * Moves the oldest waitlisted registrations into free places. Call it with the
 * event row locked, after any change that frees places. An event that has ended
 * promotes nobody (no "a place freed up" e-mail after the fact).
 */
export async function promoteFromWaitlist(
	tx: TransactionClient,
	eventId: string,
): Promise<RegistrationChange[]> {
	const free = await seatsRemaining(tx, eventId);
	if (free <= 0 || (await hasEventEnded(tx, eventId))) {
		return [];
	}
	const [event] = await tx
		.select({ status: events.status })
		.from(events)
		.where(eq(events.id, eventId));
	// Only a published event moves people up (never a cancelled one).
	if (event?.status !== "published") {
		return [];
	}
	const next = await tx
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.state, "waitlisted"),
			),
		)
		.orderBy(asc(eventRegistrations.createdAt), asc(eventRegistrations.id))
		.limit(free);
	if (next.length === 0) {
		return [];
	}
	await tx
		.update(eventRegistrations)
		.set({ state: "registered" })
		.where(
			inArray(
				eventRegistrations.id,
				next.map((row) => row.id),
			),
		);
	return next.map((row) => ({ registrationId: row.id, change: "promoted" }));
}

/** Promotes waitlisted people after a change that freed places, and reports them. */
export async function promoteAndNotify(
	tx: TransactionClient,
	eventId: string,
	hooks?: RegistrationHooks,
): Promise<void> {
	await notify(tx, hooks, await promoteFromWaitlist(tx, eventId));
}

async function findEventRegistration(
	tx: TransactionClient,
	eventId: string,
	userId: string,
): Promise<{ id: string; state: RegistrationState } | null> {
	const [row] = await tx
		.select({ id: eventRegistrations.id, state: eventRegistrations.state })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	return row ?? null;
}

async function findEventRegistrationId(
	tx: TransactionClient,
	eventId: string,
	userId: string,
): Promise<string | null> {
	const [row] = await tx
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	return row?.id ?? null;
}

/** Inserts an event registration; capacity is enforced by the seat-count CHECK (→ EVENT_FULL). */
async function insertEventRegistration(
	tx: TransactionClient,
	eventId: string,
	userId: string,
	state: RegistrationState = "registered",
	locale: "pl" | "en" = "pl",
): Promise<string> {
	const id = crypto.randomUUID();
	await tx
		.insert(eventRegistrations)
		.values({ id, eventId, userId, state, locale });
	return id;
}

const CHANGE_FOR_NEW_STATE = {
	registered: "confirmed",
	waitlisted: "waitlisted",
	pending: "pending",
} as const satisfies Record<string, RegistrationChange["change"]>;

/** A self-registration waits for approval, takes a free place, or joins the waitlist. */
async function stateForNewRegistration(
	tx: TransactionClient,
	eventId: string,
	byOrganizer: boolean,
): Promise<keyof typeof CHANGE_FOR_NEW_STATE> {
	if (!byOrganizer && (await requiresApproval(tx, eventId))) {
		return "pending";
	}
	return (await seatsRemaining(tx, eventId)) > 0 ? "registered" : "waitlisted";
}

export async function requiresApproval(
	tx: TransactionClient,
	eventId: string,
): Promise<boolean> {
	const [row] = await tx
		.select({ requiresApproval: events.requiresApproval })
		.from(events)
		.where(eq(events.id, eventId));
	return row?.requiresApproval ?? false;
}

/**
 * Registers for the event, joins its waitlist when it is full, or asks for
 * approval when the event requires it (not when an organiser adds the person).
 */
export async function registerForEvent(
	eventId: string,
	userId: string,
	locale: "pl" | "en",
	hooks?: RegistrationHooks,
	{ byOrganizer = false }: { byOrganizer?: boolean } = {},
): Promise<{ state: RegistrationState; txid: number }> {
	try {
		return await db.transaction(async (tx) => {
			if (!(await lockEvent(tx, eventId))) {
				throw new DomainError("EVENT_NOT_FOUND");
			}
			await assertEventOpen(tx, eventId);

			if (await findEventRegistrationId(tx, eventId, userId)) {
				throw new DomainError("ALREADY_REGISTERED");
			}

			const state = await stateForNewRegistration(tx, eventId, byOrganizer);
			const registrationId = await insertEventRegistration(
				tx,
				eventId,
				userId,
				state,
				locale,
			);
			await notify(tx, hooks, [
				{ registrationId, change: CHANGE_FOR_NEW_STATE[state] },
			]);
			return { state, txid: await getCurrentTxId(tx) };
		});
	} catch (error) {
		mapConstraintError(error, REGISTRATION_ERRORS);
	}
}

export async function registerForAgendaItem(
	itemId: string,
	userId: string,
	locale: "pl" | "en",
	hooks?: RegistrationHooks,
): Promise<{ txid: number; eventRegistered: boolean }> {
	try {
		return await db.transaction(async (tx) => {
			// Global lock order: event row, then items (by id), then group/member rows, then count rows.
			const [peek] = await tx
				.select({ eventId: agendaItems.eventId })
				.from(agendaItems)
				.where(eq(agendaItems.id, itemId));
			if (!peek) {
				throw new DomainError("ITEM_NOT_FOUND");
			}
			await lockEvent(tx, peek.eventId);
			const [item] = await tx
				.select({
					id: agendaItems.id,
					eventId: agendaItems.eventId,
					endsAt: agendaItems.endsAt,
					maxSeats: agendaItems.maxSeats,
					requiresRegistration: agendaItems.requiresRegistration,
				})
				.from(agendaItems)
				.where(eq(agendaItems.id, itemId))
				.for("update");

			if (!item) {
				throw new DomainError("ITEM_NOT_FOUND");
			}
			if (!item.requiresRegistration) {
				throw new DomainError("ITEM_NOT_REGISTRABLE");
			}

			await assertEventOpen(tx, item.eventId);

			if (item.endsAt.getTime() <= Date.now()) {
				throw new DomainError("ITEM_ENDED");
			}

			const [existing] = await tx
				.select({ id: agendaItemRegistrations.id })
				.from(agendaItemRegistrations)
				.where(
					and(
						eq(agendaItemRegistrations.agendaItemId, itemId),
						eq(agendaItemRegistrations.userId, userId),
					),
				);
			if (existing) {
				throw new DomainError("ALREADY_REGISTERED");
			}

			const registration = await findEventRegistration(
				tx,
				item.eventId,
				userId,
			);
			if (registration?.state === "waitlisted") {
				throw new DomainError("EVENT_WAITLISTED");
			}
			// Items come after approval: no item registration on a pending or missing one.
			if (
				registration?.state === "pending" ||
				registration?.state === "rejected" ||
				(!registration && (await requiresApproval(tx, item.eventId)))
			) {
				throw new DomainError("APPROVAL_REQUIRED");
			}
			let eventRegistrationId = registration?.id ?? null;
			const eventRegistered = eventRegistrationId === null;
			if (eventRegistrationId === null) {
				eventRegistrationId = await insertEventRegistration(
					tx,
					item.eventId,
					userId,
					"registered",
					locale,
				);
				await notify(tx, hooks, [
					{ registrationId: eventRegistrationId, change: "confirmed" },
				]);
			}

			// Item capacity (including group holds) is enforced by the seat-count CHECK (→ ITEM_FULL).
			await tx.insert(agendaItemRegistrations).values({
				id: crypto.randomUUID(),
				agendaItemId: itemId,
				eventRegistrationId,
				userId,
			});

			return { txid: await getCurrentTxId(tx), eventRegistered };
		});
	} catch (error) {
		mapConstraintError(error, REGISTRATION_ERRORS);
	}
}

export async function unregisterFromAgendaItem(
	itemId: string,
	userId: string,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		const [item] = await tx
			.select({ eventId: agendaItems.eventId })
			.from(agendaItems)
			.where(eq(agendaItems.id, itemId));
		if (item) {
			// After the event, registrations are its attendance record: no withdrawing.
			await assertEventOpen(tx, item.eventId);
		}
		const [deleted] = await tx
			.delete(agendaItemRegistrations)
			.where(
				and(
					eq(agendaItemRegistrations.agendaItemId, itemId),
					eq(agendaItemRegistrations.userId, userId),
				),
			)
			.returning({ id: agendaItemRegistrations.id });

		if (!deleted) {
			throw new DomainError("NOT_REGISTERED");
		}

		return { txid: await getCurrentTxId(tx) };
	});
}

/** Leaves the event (or its waitlist); the freed place goes to the waitlist. */
export async function unregisterFromEvent(
	eventId: string,
	userId: string,
	hooks?: RegistrationHooks,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		const existing = await findEventRegistration(tx, eventId, userId);
		// A rejected request stays, so withdrawing cannot be used to ask again.
		const id = existing?.state === "rejected" ? null : (existing?.id ?? null);
		return withdraw(tx, eventId, id, hooks);
	});
}

/**
 * Removes a registration (its item registrations cascade) and promotes the
 * waitlist. Call with the event row locked. After the event, registrations are
 * its attendance record: no withdrawing.
 */
async function withdraw(
	tx: TransactionClient,
	eventId: string,
	registrationId: string | null,
	hooks?: RegistrationHooks,
): Promise<{ txid: number }> {
	if (!registrationId) {
		throw new DomainError("NOT_REGISTERED");
	}
	await assertEventOpen(tx, eventId);
	await tx
		.delete(eventRegistrations)
		.where(eq(eventRegistrations.id, registrationId));
	await promoteAndNotify(tx, eventId, hooks);
	return { txid: await getCurrentTxId(tx) };
}

/** An organizer removes someone from the event (same rules as withdrawing). */
export async function removeRegistrant(
	eventId: string,
	registrationId: string,
	hooks?: RegistrationHooks,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		const [row] = await tx
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.id, registrationId),
					eq(eventRegistrations.eventId, eventId),
				),
			);
		return withdraw(tx, eventId, row?.id ?? null, hooks);
	});
}

/**
 * An organizer removes several people at once: one lock, one waitlist
 * promotion. Ids that are no longer there (removed in another tab) are skipped.
 */
export async function removeRegistrants(
	eventId: string,
	registrationIds: string[],
	hooks?: RegistrationHooks,
): Promise<{ removed: number; txid: number }> {
	return db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		await assertEventOpen(tx, eventId);
		const removed =
			registrationIds.length === 0
				? []
				: await tx
						.delete(eventRegistrations)
						.where(
							and(
								eq(eventRegistrations.eventId, eventId),
								inArray(eventRegistrations.id, registrationIds),
							),
						)
						.returning({ id: eventRegistrations.id });
		await promoteAndNotify(tx, eventId, hooks);
		return { removed: removed.length, txid: await getCurrentTxId(tx) };
	});
}

/** An organizer adds an existing account by e-mail; the same rules as registering (waitlist when full). */
export async function addRegistrantByEmail(
	eventId: string,
	email: string,
	locale: "pl" | "en",
	hooks?: RegistrationHooks,
): Promise<{ state: RegistrationState; txid: number }> {
	const user = await findAccountByEmail(email);
	if (!user) {
		throw new DomainError("USER_NOT_FOUND");
	}
	return registerForEvent(eventId, user.id, locale, hooks, {
		byOrganizer: true,
	});
}

type MyRegistrationState = {
	eventId: string;
	state: RegistrationState;
	/** 1-based place on the waitlist; null when registered. */
	waitlistPosition: number | null;
};

async function getMyRegistrationStates(
	userId: string,
): Promise<MyRegistrationState[]> {
	const rows = await db.execute<{
		event_id: string;
		state: RegistrationState;
		position: number | null;
	}>(sql`
		SELECT mine.event_id, mine.state,
			CASE WHEN mine.state = 'waitlisted' THEN (
				SELECT count(*)::int FROM event_registrations w
				WHERE w.event_id = mine.event_id AND w.state = 'waitlisted'
					AND (w.created_at, w.id) <= (mine.created_at, mine.id)
			) END AS position
		FROM event_registrations mine
		WHERE mine.user_id = ${userId}
	`);
	return rows.map((row) => ({
		eventId: row.event_id,
		state: row.state,
		waitlistPosition: row.position,
	}));
}

export type MyRegistrations = {
	/** Every event the user is registered for or waiting for. */
	events: MyRegistrationState[];
	agendaItemIds: string[];
};

/** The user's registrations: one source for the event list and the event page. */
export async function getMyRegistrations(
	userId: string,
): Promise<MyRegistrations> {
	const [events, itemRows] = await Promise.all([
		getMyRegistrationStates(userId),
		db
			.select({ agendaItemId: agendaItemRegistrations.agendaItemId })
			.from(agendaItemRegistrations)
			.where(eq(agendaItemRegistrations.userId, userId)),
	]);
	return { events, agendaItemIds: itemRows.map((row) => row.agendaItemId) };
}

export type RegistrationForEmail = {
	state: RegistrationState;
	locale: "pl" | "en";
	email: string;
	eventId: string;
	eventTitle: string;
	eventDate: Date;
	eventStatus: EventStatus;
};

/** What a registration e-mail needs; null when the registration no longer exists. */
export async function getRegistrationForEmail(
	registrationId: string,
): Promise<RegistrationForEmail | null> {
	const [row] = await db
		.select({
			state: eventRegistrations.state,
			locale: eventRegistrations.locale,
			email: authUsers.email,
			eventId: events.id,
			eventTitle: events.title,
			eventDate: events.date,
			eventStatus: events.status,
		})
		.from(eventRegistrations)
		.innerJoin(authUsers, eq(authUsers.id, eventRegistrations.userId))
		.innerJoin(events, eq(events.id, eventRegistrations.eventId))
		.where(eq(eventRegistrations.id, registrationId));
	return row ?? null;
}

export type EventRegistrant = {
	registrationId: string;
	userId: string;
	email: string;
	name: string | null;
	registeredAt: Date;
	state: RegistrationState;
	agendaItemIds: string[];
	groupId: string | null;
	groupName: string | null;
	checkedInAt: Date | null;
};

export async function getEventRegistrants(
	eventId: string,
): Promise<EventRegistrant[]> {
	const rows = await db
		.select({
			registrationId: eventRegistrations.id,
			userId: eventRegistrations.userId,
			email: authUsers.email,
			name: authUsers.name,
			registeredAt: eventRegistrations.createdAt,
			state: eventRegistrations.state,
			groupId: eventRegistrations.groupId,
			groupName: registrationGroups.name,
			checkedInAt: eventRegistrations.checkedInAt,
			agendaItemIds: sql<string[]>`coalesce(
				array_agg(${agendaItemRegistrations.agendaItemId})
					filter (where ${agendaItemRegistrations.agendaItemId} is not null),
				'{}'
			)`,
		})
		.from(eventRegistrations)
		.innerJoin(authUsers, eq(eventRegistrations.userId, authUsers.id))
		.leftJoin(
			registrationGroups,
			eq(registrationGroups.id, eventRegistrations.groupId),
		)
		.leftJoin(
			agendaItemRegistrations,
			eq(agendaItemRegistrations.eventRegistrationId, eventRegistrations.id),
		)
		.where(eq(eventRegistrations.eventId, eventId))
		.groupBy(eventRegistrations.id, authUsers.id, registrationGroups.id)
		.orderBy(asc(eventRegistrations.createdAt));

	return rows;
}

/** Whether the user holds a place (registered, not waitlisted) at the event. */
export async function isRegisteredForEvent(
	eventId: string,
	userId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
				eq(eventRegistrations.state, "registered"),
			),
		)
		.limit(1);
	return Boolean(row);
}
