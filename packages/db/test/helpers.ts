import { eq, sql } from "drizzle-orm";
import { expect } from "vitest";
import { db } from "../src/client";
import {
	agendaItemSeatCounts,
	agendaItems,
} from "../src/schema/agenda";
import { authUsers } from "../src/schema/better-auth";
import {
	registrationGroupItems,
	registrationGroupMemberItems,
	registrationGroupMembers,
	registrationGroups,
} from "../src/schema/groups";
import { eventTypes } from "../src/schema/event-lookups";
import { eventSeatCounts } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";

const TEST_TYPE_ID = "test-type";

export async function resetDb(): Promise<void> {
	await db.execute(sql`
		TRUNCATE registration_group_member_items, registration_group_members,
			registration_group_items, registration_groups, agenda_item_registrations, agenda_item_seat_counts, agenda_items,
			event_registrations, event_seat_counts, events, event_types,
			event_locations, event_faculties, "user" CASCADE
	`);
}

export async function createUser(email?: string): Promise<string> {
	const id = crypto.randomUUID();
	await db.insert(authUsers).values({
		id,
		name: "Test User",
		email: email ?? `${id}@example.test`,
		emailVerified: true,
	});
	return id;
}

export async function createEvent(opts?: {
	maxSeats?: number;
	date?: Date;
	endsAt?: Date | null;
}): Promise<string> {
	await db
		.insert(eventTypes)
		.values({ id: TEST_TYPE_ID, slug: TEST_TYPE_ID, label: "Test" })
		.onConflictDoNothing();
	const [event] = await db
		.insert(events)
		.values({
			title: "Test event",
			date: opts?.date ?? new Date(Date.now() + 86_400_000),
			endsAt: opts?.endsAt ?? null,
			maxSeats: opts?.maxSeats ?? 10,
			typeId: TEST_TYPE_ID,
		})
		.returning({ id: events.id });
	if (!event) throw new Error("event insert failed");
	return event.id;
}

export async function createItem(
	eventId: string,
	opts?: {
		maxSeats?: number | null;
		requiresRegistration?: boolean;
		startsAt?: Date;
		endsAt?: Date;
		title?: string;
	},
): Promise<string> {
	const startsAt = opts?.startsAt ?? new Date(Date.now() + 86_400_000);
	const endsAt = opts?.endsAt ?? new Date(startsAt.getTime() + 3_600_000);
	const [item] = await db
		.insert(agendaItems)
		.values({
			eventId,
			title: opts?.title ?? "Test item",
			startsAt,
			endsAt,
			maxSeats: opts && "maxSeats" in opts ? opts.maxSeats : 10,
			requiresRegistration: opts?.requiresRegistration ?? true,
		})
		.returning({ id: agendaItems.id });
	if (!item) throw new Error("item insert failed");
	return item.id;
}

export async function readEventCount(eventId: string) {
	const [row] = await db
		.select({
			maxSeats: eventSeatCounts.maxSeats,
			seatsRemaining: eventSeatCounts.seatsRemaining,
		})
		.from(eventSeatCounts)
		.where(eq(eventSeatCounts.eventId, eventId));
	return row;
}

export async function readItemCount(itemId: string) {
	const [row] = await db
		.select({
			maxSeats: agendaItemSeatCounts.maxSeats,
			seatsRemaining: agendaItemSeatCounts.seatsRemaining,
			registeredCount: agendaItemSeatCounts.registeredCount,
		})
		.from(agendaItemSeatCounts)
		.where(eq(agendaItemSeatCounts.agendaItemId, itemId));
	return row;
}

function constraintNameOf(error: unknown): string | undefined {
	let current: unknown = error;
	while (current && typeof current === "object") {
		if ("constraint_name" in current) {
			return String((current as { constraint_name: unknown }).constraint_name);
		}
		current = (current as { cause?: unknown }).cause;
	}
	return undefined;
}

export async function expectConstraintViolation(
	promise: Promise<unknown>,
	constraint: string,
) {
	const error = await promise.then(
		() => undefined,
		(e: unknown) => e,
	);
	expect(error, "expected a constraint violation").toBeDefined();
	expect(constraintNameOf(error)).toBe(constraint);
}

export const HOUR = 3_600_000;

export function hoursFromNow(hours: number): Date {
	return new Date(Date.now() + hours * HOUR);
}

export async function rejectionCode(promise: Promise<unknown>) {
	return promise.then(
		() => "RESOLVED",
		(error: unknown) =>
			error && typeof error === "object" && "code" in error
				? String((error as { code: unknown }).code)
				: String(error),
	);
}

export async function createGroupRow(
	eventId: string,
	ownerUserId: string,
	opts: { places: number; itemIds?: string[]; status?: "open" | "closed" | "cancelled" },
): Promise<string> {
	const [group] = await db
		.insert(registrationGroups)
		.values({
			eventId,
			ownerUserId,
			places: opts.places,
			status: opts.status ?? "open",
		})
		.returning({ id: registrationGroups.id });
	if (!group) throw new Error("group insert failed");
	if (opts.itemIds?.length) {
		await db
			.insert(registrationGroupItems)
			.values(opts.itemIds.map((agendaItemId) => ({ groupId: group.id, agendaItemId })));
	}
	return group.id;
}

export async function addMemberRow(
	groupId: string,
	email: string,
	opts: { status?: "invited" | "confirmed"; itemIds?: string[]; eventRegistrationId?: string; userId?: string } = {},
): Promise<string> {
	const [member] = await db
		.insert(registrationGroupMembers)
		.values({
			groupId,
			email,
			status: opts.status ?? "invited",
			invitedVia: "email",
			eventRegistrationId: opts.eventRegistrationId ?? null,
			userId: opts.userId ?? null,
		})
		.returning({ id: registrationGroupMembers.id });
	if (!member) throw new Error("member insert failed");
	if (opts.itemIds?.length) {
		await db
			.insert(registrationGroupMemberItems)
			.values(opts.itemIds.map((agendaItemId) => ({ memberId: member.id, agendaItemId })));
	}
	return member.id;
}
