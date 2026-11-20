import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import { eventOrganizers } from "../schema/event-organizers";
import { DomainError, mapConstraintError } from "./domain-errors";
import { lockEvent } from "./locks";
import { getUserRole } from "./roles";

export type EventOrganizer = {
	userId: string;
	email: string;
	name: string;
	addedAt: Date;
};

/** Organizers and admins may create events. */
export async function canCreateEvents(userId: string): Promise<boolean> {
	const role = await getUserRole(userId);
	return role === "organizer" || role === "admin";
}

async function isOrganizerOf(userId: string, eventId: string) {
	const [row] = await db
		.select({ userId: eventOrganizers.userId })
		.from(eventOrganizers)
		.where(
			and(
				eq(eventOrganizers.eventId, eventId),
				eq(eventOrganizers.userId, userId),
			),
		);
	return Boolean(row);
}

/** Admins manage every event; everyone else only the events they organize. */
export async function canManageEvent(
	userId: string,
	eventId: string,
): Promise<boolean> {
	if ((await getUserRole(userId)) === "admin") {
		return true;
	}
	return isOrganizerOf(userId, eventId);
}

/** Whether the user may open the admin panel: can create events or organizes at least one. */
export async function hasPanelAccess(userId: string): Promise<boolean> {
	if (await canCreateEvents(userId)) {
		return true;
	}
	const [row] = await db
		.select({ n: count() })
		.from(eventOrganizers)
		.where(eq(eventOrganizers.userId, userId));
	return (row?.n ?? 0) > 0;
}

/** The ids of the events the user manages, or "all" for admins. */
export async function listManagedEventIds(
	userId: string,
): Promise<string[] | "all"> {
	if ((await getUserRole(userId)) === "admin") {
		return "all";
	}
	const rows = await db
		.select({ eventId: eventOrganizers.eventId })
		.from(eventOrganizers)
		.where(eq(eventOrganizers.userId, userId));
	return rows.map((row) => row.eventId);
}

export async function listEventOrganizers(
	eventId: string,
): Promise<EventOrganizer[]> {
	return db
		.select({
			userId: eventOrganizers.userId,
			email: authUsers.email,
			name: authUsers.name,
			addedAt: eventOrganizers.createdAt,
		})
		.from(eventOrganizers)
		.innerJoin(authUsers, eq(authUsers.id, eventOrganizers.userId))
		.where(eq(eventOrganizers.eventId, eventId))
		.orderBy(asc(eventOrganizers.createdAt), asc(authUsers.email));
}

/** Adds an existing account (by e-mail, any case) as an organizer of the event. */
export async function addEventOrganizer(
	eventId: string,
	email: string,
): Promise<EventOrganizer> {
	const [user] = await db
		.select({ id: authUsers.id, email: authUsers.email, name: authUsers.name })
		.from(authUsers)
		.where(eq(sql`lower(${authUsers.email})`, email.trim().toLowerCase()));
	if (!user) {
		throw new DomainError("USER_NOT_FOUND");
	}
	try {
		const [row] = await db
			.insert(eventOrganizers)
			.values({ eventId, userId: user.id })
			.returning({ addedAt: eventOrganizers.createdAt });
		return {
			userId: user.id,
			email: user.email,
			name: user.name,
			addedAt: row?.addedAt ?? new Date(),
		};
	} catch (error) {
		mapConstraintError(error, { unique: "ALREADY_ORGANIZER" });
	}
}

/** Removes an organizer; an event always keeps at least one. */
export async function removeEventOrganizer(
	eventId: string,
	userId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		const [row] = await tx
			.select({ n: count() })
			.from(eventOrganizers)
			.where(eq(eventOrganizers.eventId, eventId));
		if ((row?.n ?? 0) <= 1) {
			throw new DomainError("LAST_ORGANIZER");
		}
		await tx
			.delete(eventOrganizers)
			.where(
				and(
					eq(eventOrganizers.eventId, eventId),
					eq(eventOrganizers.userId, userId),
				),
			);
	});
}
