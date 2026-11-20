import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";
import {
	type EventOrganizerRole,
	eventOrganizers,
} from "../schema/event-organizers";
import { DomainError, mapConstraintError } from "./domain-errors";
import { lockEvent } from "./locks";
import type { UserRole } from "./roles";
import { findAccountByEmail } from "./users";

export type EventOrganizer = {
	userId: string;
	email: string;
	name: string;
	role: EventOrganizerRole;
	addedAt: Date;
};

/** Who is asking: callers already know the role (it is on the session user). */
export type PanelUser = { id: string; role: UserRole };

/** Organizers and admins may create events. */
export function canCreateEvents(role: UserRole): boolean {
	return role === "organizer" || role === "admin";
}

/** Admins manage every event; everyone else only the events they run as a manager. */
export async function canManageEvent(
	user: PanelUser,
	eventId: string,
): Promise<boolean> {
	return hasEventRole(user, eventId, "manager");
}

/** Scanning tickets and marking attendance: managers and check-in helpers (and admins). */
export async function canCheckIn(
	user: PanelUser,
	eventId: string,
): Promise<boolean> {
	return hasEventRole(user, eventId, null);
}

async function hasEventRole(
	user: PanelUser,
	eventId: string,
	role: EventOrganizerRole | null,
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
				role ? eq(eventOrganizers.role, role) : undefined,
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

/** The ids of the events the user organizes (any role, or only one), or "all" for admins. */
export async function listManagedEventIds(
	user: PanelUser,
	role?: EventOrganizerRole,
): Promise<string[] | "all"> {
	if (user.role === "admin") {
		return "all";
	}
	const rows = await db
		.select({ eventId: eventOrganizers.eventId })
		.from(eventOrganizers)
		.where(
			and(
				eq(eventOrganizers.userId, user.id),
				role ? eq(eventOrganizers.role, role) : undefined,
			),
		);
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
			role: eventOrganizers.role,
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
	role: EventOrganizerRole = "manager",
): Promise<EventOrganizer> {
	const user = await findAccountByEmail(email);
	if (!user) {
		throw new DomainError("USER_NOT_FOUND");
	}
	try {
		const [row] = await db
			.insert(eventOrganizers)
			.values({ eventId, userId: user.id, role })
			.returning({ addedAt: eventOrganizers.createdAt });
		return {
			userId: user.id,
			email: user.email,
			name: user.name,
			role,
			addedAt: row?.addedAt ?? new Date(),
		};
	} catch (error) {
		mapConstraintError(error, { unique: "ALREADY_ORGANIZER" });
	}
}

/** Removes an organizer or helper; an event always keeps at least one manager. */
export async function removeEventOrganizer(
	eventId: string,
	userId: string,
): Promise<void> {
	await db.transaction(async (tx) => {
		await lockEvent(tx, eventId);
		const managers = await tx
			.select({ userId: eventOrganizers.userId })
			.from(eventOrganizers)
			.where(
				and(
					eq(eventOrganizers.eventId, eventId),
					eq(eventOrganizers.role, "manager"),
				),
			);
		if (
			managers.length <= 1 &&
			managers.some((manager) => manager.userId === userId)
		) {
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
