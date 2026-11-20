import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { agendaItemRegistrations, agendaItems } from "../schema/agenda";
import { authUsers } from "../schema/better-auth";
import { eventRegistrations } from "../schema/event-registrations";
import { events } from "../schema/events";
import { registrationGroups } from "../schema/groups";
import { DomainError } from "./domain-errors";
import {
	effectiveEventEndSql,
	type RegistrationHooks,
	unregisterFromEvent,
} from "./event-registrations";
import { closeGroup } from "./groups";

export type AccountDataExport = {
	exportedAt: string;
	profile: { name: string; email: string; createdAt: string };
	registrations: {
		state: string;
		registeredAt: string;
		checkedInAt: string | null;
		event: { id: string; title: string; date: string };
		agendaItems: string[];
	}[];
	groups: {
		name: string | null;
		places: number;
		status: string;
		event: { id: string; title: string };
	}[];
};

/** Everything the service keeps about a person, for the "download my data" button (GDPR). */
export async function exportAccountData(
	userId: string,
): Promise<AccountDataExport> {
	const [profile] = await db
		.select({
			name: authUsers.name,
			email: authUsers.email,
			createdAt: authUsers.createdAt,
		})
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	if (!profile) {
		throw new DomainError("USER_NOT_FOUND");
	}
	const [registrations, items, groups] = await Promise.all([
		db
			.select({
				id: eventRegistrations.id,
				state: eventRegistrations.state,
				registeredAt: eventRegistrations.createdAt,
				checkedInAt: eventRegistrations.checkedInAt,
				eventId: events.id,
				title: events.title,
				date: events.date,
			})
			.from(eventRegistrations)
			.innerJoin(events, eq(events.id, eventRegistrations.eventId))
			.where(eq(eventRegistrations.userId, userId))
			.orderBy(asc(events.date)),
		db
			.select({
				registrationId: agendaItemRegistrations.eventRegistrationId,
				title: agendaItems.title,
			})
			.from(agendaItemRegistrations)
			.innerJoin(
				agendaItems,
				eq(agendaItems.id, agendaItemRegistrations.agendaItemId),
			)
			.where(eq(agendaItemRegistrations.userId, userId)),
		db
			.select({
				name: registrationGroups.name,
				places: registrationGroups.places,
				status: registrationGroups.status,
				eventId: events.id,
				title: events.title,
			})
			.from(registrationGroups)
			.innerJoin(events, eq(events.id, registrationGroups.eventId))
			.where(eq(registrationGroups.ownerUserId, userId)),
	]);
	return {
		exportedAt: new Date().toISOString(),
		profile: {
			name: profile.name,
			email: profile.email,
			createdAt: profile.createdAt.toISOString(),
		},
		registrations: registrations.map((row) => ({
			state: row.state,
			registeredAt: row.registeredAt.toISOString(),
			checkedInAt: row.checkedInAt?.toISOString() ?? null,
			event: {
				id: row.eventId,
				title: row.title,
				date: row.date.toISOString(),
			},
			agendaItems: items
				.filter((item) => item.registrationId === row.id)
				.map((item) => item.title),
		})),
		groups: groups.map((row) => ({
			name: row.name,
			places: row.places,
			status: row.status,
			event: { id: row.eventId, title: row.title },
		})),
	};
}

/**
 * Deletes an account. Upcoming registrations are withdrawn and the person's
 * open groups closed first, the normal way, so their places go to the waitlist;
 * then the user row goes (sessions, accounts and past registrations cascade).
 */
export async function deleteAccount(
	userId: string,
	hooks?: RegistrationHooks,
): Promise<void> {
	await assertCanLeave(userId);
	const registrations = await db
		.select({ eventId: eventRegistrations.eventId })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.userId, userId));
	for (const { eventId } of registrations) {
		await withdrawIfOpen(() => unregisterFromEvent(eventId, userId, hooks));
	}
	const openGroups = await db
		.select({ id: registrationGroups.id })
		.from(registrationGroups)
		.where(
			and(
				eq(registrationGroups.ownerUserId, userId),
				eq(registrationGroups.status, "open"),
			),
		);
	for (const { id } of openGroups) {
		await withdrawIfOpen(() => closeGroup(id, userId, undefined, hooks));
	}
	await db.delete(authUsers).where(eq(authUsers.id, userId));
}

/** Ended or cancelled events refuse withdrawal; their rows simply go with the account. */
async function withdrawIfOpen(withdraw: () => Promise<unknown>) {
	try {
		await withdraw();
	} catch (error) {
		if (!(error instanceof DomainError)) {
			throw error;
		}
	}
}

/** Nobody may leave events without an organizer, or the instance without an admin. */
async function assertCanLeave(userId: string): Promise<void> {
	const [user] = await db
		.select({ role: authUsers.role })
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	if (user?.role === "admin") {
		const [admins] = await db
			.select({ n: count() })
			.from(authUsers)
			.where(eq(authUsers.role, "admin"));
		if ((admins?.n ?? 0) <= 1) {
			throw new DomainError("LAST_ADMIN");
		}
	}
	const orphaned = await db.execute<{ id: string }>(sql`
		SELECT e.id FROM events e
		JOIN event_organizers mine ON mine.event_id = e.id AND mine.user_id = ${userId} AND mine.role = 'manager'
		WHERE e.status <> 'cancelled'
			AND ${effectiveEventEndSql(sql`e`)} > now()
			AND (SELECT count(*) FROM event_organizers o WHERE o.event_id = e.id AND o.role = 'manager') = 1
		LIMIT 1`);
	if (orphaned.length > 0) {
		throw new DomainError("SOLE_ORGANIZER");
	}
}
