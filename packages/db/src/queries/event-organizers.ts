import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import { eventOrganizers } from "../schema/event-organizers";
import { DomainError, mapConstraintError } from "./domain-errors";
import { lockEvent } from "./locks";
import type { UserRole } from "./roles";
import { findAccountByEmail } from "./users";

export type EventOrganizer = {
	userId: string;
	email: string;
	name: string;
	addedAt: Date;
};

/** Who is asking: callers already know the role (it is on the session user). */
export type PanelUser = { id: string; role: UserRole };

/** Organizers and admins may create events. */
export function canCreateEvents(role: UserRole): boolean {
	return role === "organizer" || role === "admin";
}

/** Admins manage every event; everyone else only the events they organize. */
export async function canManageEvent(
	user: PanelUser,
	eventId: string,
): Promise<boolean> {
	if (user.role === "admin") {
		return true;
	}
	const [row] = await db
		.select({ userId: eventOrganizers.userId })
		.from(eventOrganizers)
		.where(
			and(
				eq(eventOrganizers.eventId, eventId),
				eq(eventOrganizers.userId, user.id),
			),
		)
		.limit(1);
	return Boolean(row);
}

/** Whether the user may open the admin panel: can create events or organizes at least one. */
export async function hasPanelAccess(user: PanelUser): Promise<boolean> {
	if (canCreateEvents(user.role)) {
		return true;
	}
	const [row] = await db
		.select({ userId: eventOrganizers.userId })
		.from(eventOrganizers)
		.where(eq(eventOrganizers.userId, user.id))
		.limit(1);
	return Boolean(row);
}

/** The ids of the events the user manages, or "all" for admins. */
export async function listManagedEventIds(
	user: PanelUser,
): Promise<string[] | "all"> {
	if (user.role === "admin") {
		return "all";
	}
	const rows = await db
		.select({ eventId: eventOrganizers.eventId })
		.from(eventOrganizers)
		.where(eq(eventOrganizers.userId, user.id));
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
	const user = await findAccountByEmail(email);
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
