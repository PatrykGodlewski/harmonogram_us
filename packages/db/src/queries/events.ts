import { env as clientEnv } from "@repo/env/client";
import { and, asc, desc, eq, ilike, inArray, max, ne, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { agendaItems } from "../schema/agenda";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import { eventOrganizers } from "../schema/event-organizers";
import {
	eventRegistrations,
	eventSeatCounts,
} from "../schema/event-registrations";
import {
	type AttendanceMode,
	type EventStatus,
	type EventVisibility,
	events,
} from "../schema/events";
import { registrationGroups } from "../schema/groups";
import { type AgendaItem, listAgendaItems } from "./agenda-items";
import {
	CAPACITY_EDIT_ERRORS,
	DomainError,
	mapConstraintError,
} from "./domain-errors";
import { missingForPublish } from "./event-completeness";
import { type EventQuestion, listEventQuestions } from "./event-questions";
import {
	type EventWhenWhere,
	effectiveEventEndSql,
	hasEventEnded,
	notify,
	promoteAndNotify,
	type RegistrationHooks,
} from "./event-registrations";
import { lockEvent } from "./locks";
import { getCurrentTxId } from "./txid";

/**
 * Who is looking: the public site never sees drafts (nor signed-in-only events
 * when nobody is signed in, nor invite-only ones unless the caller has checked
 * access: `includePrivate`); the panel sees everything.
 */
export type EventAudience =
	| { kind: "public"; signedIn: boolean; includePrivate?: boolean }
	| { kind: "manage" };

export type EventFilters = {
	audience: EventAudience;
	/** Only these events (the panel list of an organizer). */
	ids?: string[];
	search?: string;
	sortOrder?: "asc" | "desc";
	locationFilter?: string;
	facultyFilter?: string;
	eventTypeFilter?: string;
	/** Events starting today, or within the next 7 or 30 days (installation time zone). */
	whenFilter?: "all" | "today" | "7d" | "30d";
	modeFilter?: "all" | AttendanceMode;
};

const WHEN_DAYS = { today: 1, "7d": 7, "30d": 30 } as const;

export type EventWithRelations = {
	id: string;
	title: string;
	description: string | null;
	date: Date;
	endsAt: Date | null;
	maxSeats: number;
	groupDeadlineHours: number;
	seatsRemaining: number;
	typeId: string;
	locationId: string | null;
	facultyId: string | null;
	status: EventStatus;
	publishedAt: Date | null;
	cancelledAt: Date | null;
	onlineUrl: string | null;
	attendanceMode: AttendanceMode;
	room: string | null;
	reminderHoursBefore: number | null;
	visibility: EventVisibility;
	requiresApproval: boolean;
	certificatesEnabled: boolean;
	certificateIssuer: string | null;
	certificateSigner: string | null;
	certificateNote: string | null;
	/** Registering asks questions (the list sends people to the event page to answer). */
	hasQuestions: boolean;
	/** End, else the end of its last agenda item, else a day after the start. */
	effectiveEndsAt: Date;
	createdAt: Date;
	updatedAt: Date;
	typeLabel: string;
	typeSlug: string;
	locationLabel: string | null;
	locationSlug: string | null;
	facultyLabel: string | null;
	facultySlug: string | null;
};

export type FilterOption = {
	id: string;
	slug: string;
	label: string;
};

export type EventFilterOptions = {
	types: FilterOption[];
	locations: FilterOption[];
	faculties: FilterOption[];
};

export async function getEventFilterOptions(): Promise<EventFilterOptions> {
	const [types, locations, faculties] = await Promise.all([
		db
			.select({
				id: eventTypes.id,
				slug: eventTypes.slug,
				label: eventTypes.label,
			})
			.from(eventTypes)
			.orderBy(asc(eventTypes.sortOrder)),
		db
			.select({
				id: eventLocations.id,
				slug: eventLocations.slug,
				label: eventLocations.label,
			})
			.from(eventLocations)
			.orderBy(asc(eventLocations.sortOrder)),
		db
			.select({
				id: eventFaculties.id,
				slug: eventFaculties.slug,
				label: eventFaculties.label,
			})
			.from(eventFaculties)
			.orderBy(asc(eventFaculties.sortOrder)),
	]);

	return { types, locations, faculties };
}

export type EventPage = { events: EventWithRelations[]; hasMore: boolean };

/** The first `limit` events matching the filters, and whether there are more (the public list). */
export async function getEventPage(
	filters: EventFilters,
	limit: number,
): Promise<EventPage> {
	const rows = await queryEvents(filters, undefined, limit + 1);
	return { events: rows.slice(0, limit), hasMore: rows.length > limit };
}

async function queryEvents(
	filters: EventFilters,
	eventId?: string,
	limit?: number,
): Promise<EventWithRelations[]> {
	const conditions = [];

	if (filters.audience.kind === "public") {
		conditions.push(ne(events.status, "draft"));
		if (!filters.audience.signedIn) {
			conditions.push(
				filters.audience.includePrivate
					? ne(events.visibility, "authenticated")
					: eq(events.visibility, "public"),
			);
		} else if (!filters.audience.includePrivate) {
			conditions.push(ne(events.visibility, "private"));
		}
	}

	if (eventId) {
		conditions.push(eq(events.id, eventId));
	}

	if (filters?.ids) {
		conditions.push(
			filters.ids.length > 0 ? inArray(events.id, filters.ids) : sql`false`,
		);
	}

	if (filters?.search) {
		conditions.push(ilike(events.title, `%${filters.search}%`));
	}

	if (filters?.locationFilter && filters.locationFilter !== "all") {
		conditions.push(eq(eventLocations.slug, filters.locationFilter));
	}

	if (filters?.facultyFilter && filters.facultyFilter !== "all") {
		conditions.push(eq(eventFaculties.slug, filters.facultyFilter));
	}

	if (filters?.eventTypeFilter && filters.eventTypeFilter !== "all") {
		conditions.push(eq(eventTypes.slug, filters.eventTypeFilter));
	}

	if (filters.modeFilter && filters.modeFilter !== "all") {
		conditions.push(eq(events.attendanceMode, filters.modeFilter));
	}

	if (filters.whenFilter && filters.whenFilter !== "all") {
		const zone = clientEnv.VITE_APP_TIME_ZONE;
		// Day boundaries are computed in local time, so "7 days" stays 7 calendar days across DST.
		const today = sql`date_trunc('day', now() AT TIME ZONE ${zone})`;
		conditions.push(
			sql`${events.date} >= (${today} AT TIME ZONE ${zone})`,
			sql`${events.date} < ((${today} + make_interval(days => ${WHEN_DAYS[filters.whenFilter]})) AT TIME ZONE ${zone})`,
		);
	}

	// The id breaks ties, so pages stay stable for events at the same time.
	const order =
		filters?.sortOrder === "asc"
			? [asc(events.date), asc(events.id)]
			: [desc(events.date), desc(events.id)];

	const rows = await db
		.select({
			id: events.id,
			title: events.title,
			description: events.description,
			date: events.date,
			endsAt: events.endsAt,
			groupDeadlineHours: events.groupDeadlineHours,
			maxSeats: events.maxSeats,
			seatsRemainingFromCounts: eventSeatCounts.seatsRemaining,
			typeId: events.typeId,
			locationId: events.locationId,
			facultyId: events.facultyId,
			status: events.status,
			publishedAt: events.publishedAt,
			cancelledAt: events.cancelledAt,
			// The meeting link is for registered people only: never on the public site's reads.
			onlineUrl:
				filters.audience.kind === "public"
					? sql<string | null>`null`
					: events.onlineUrl,
			attendanceMode: events.attendanceMode,
			room: events.room,
			reminderHoursBefore: events.reminderHoursBefore,
			visibility: events.visibility,
			requiresApproval: events.requiresApproval,
			certificatesEnabled: events.certificatesEnabled,
			certificateIssuer: events.certificateIssuer,
			certificateSigner: events.certificateSigner,
			certificateNote: events.certificateNote,
			hasQuestions: sql<boolean>`exists (select 1 from event_questions q where q.event_id = "events"."id")`,
			effectiveEndsAt:
				sql<Date>`${effectiveEventEndSql(sql`"events"`)}`.mapWith(
					(value: string | Date) => new Date(value),
				),
			createdAt: events.createdAt,
			updatedAt: events.updatedAt,
			typeLabel: eventTypes.label,
			typeSlug: eventTypes.slug,
			locationLabel: eventLocations.label,
			locationSlug: eventLocations.slug,
			facultyLabel: eventFaculties.label,
			facultySlug: eventFaculties.slug,
		})
		.from(events)
		.innerJoin(eventTypes, eq(events.typeId, eventTypes.id))
		.leftJoin(eventLocations, eq(events.locationId, eventLocations.id))
		.leftJoin(eventFaculties, eq(events.facultyId, eventFaculties.id))
		.leftJoin(eventSeatCounts, eq(events.id, eventSeatCounts.eventId))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(...order)
		.limit(limit ?? Number.MAX_SAFE_INTEGER);

	return rows.map(({ seatsRemainingFromCounts, ...row }) => ({
		...row,
		seatsRemaining: seatsRemainingFromCounts ?? row.maxSeats,
	}));
}

export type CreateEventInput = {
	id?: string;
	groupDeadlineHours?: number;
	title: string;
	description?: string | null;
	date: Date;
	endsAt?: Date | null;
	maxSeats: number;
	typeId: string;
	locationId?: string | null;
	facultyId?: string | null;
	onlineUrl?: string | null;
	attendanceMode?: AttendanceMode;
	visibility?: EventVisibility;
	room?: string | null;
	reminderHoursBefore?: number | null;
	requiresApproval?: boolean;
	certificatesEnabled?: boolean;
	certificateIssuer?: string | null;
	certificateSigner?: string | null;
	certificateNote?: string | null;
	/** Becomes the event's first organizer; null for events only admins manage (seed data). */
	organizerId: string | null;
};

export async function createEvent(input: CreateEventInput) {
	return db.transaction(async (tx) => {
		const [event] = await tx
			.insert(events)
			.values({
				...(input.id ? { id: input.id } : {}),
				title: input.title,
				description: input.description ?? null,
				date: input.date,
				endsAt: input.endsAt ?? null,
				...(input.groupDeadlineHours !== undefined
					? { groupDeadlineHours: input.groupDeadlineHours }
					: {}),
				maxSeats: input.maxSeats,
				typeId: input.typeId,
				locationId: input.locationId ?? null,
				facultyId: input.facultyId ?? null,
				onlineUrl: input.onlineUrl ?? null,
				attendanceMode: input.attendanceMode ?? "onsite",
				visibility: input.visibility ?? "public",
				inviteToken: input.visibility === "private" ? newInviteToken() : null,
				room: input.room ?? null,
				requiresApproval: input.requiresApproval ?? false,
				certificatesEnabled: input.certificatesEnabled ?? false,
				certificateIssuer: input.certificateIssuer ?? null,
				certificateSigner: input.certificateSigner ?? null,
				certificateNote: input.certificateNote ?? null,
				...(input.reminderHoursBefore !== undefined
					? { reminderHoursBefore: input.reminderHoursBefore }
					: {}),
			})
			.returning();
		if (event && input.organizerId) {
			await tx
				.insert(eventOrganizers)
				.values({ eventId: event.id, userId: input.organizerId });
		}
		return event;
	});
}

/** An unguessable invite-link secret (256 bits, hex). */
export function newInviteToken(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
		"hex",
	);
}

/** Replaces the invite link of an event; the old link stops working. */
export async function regenerateInviteToken(eventId: string): Promise<string> {
	const token = newInviteToken();
	const [row] = await db
		.update(events)
		.set({ inviteToken: token, updatedAt: new Date() })
		.where(eq(events.id, eventId))
		.returning({ id: events.id });
	if (!row) {
		throw new DomainError("EVENT_NOT_FOUND");
	}
	return token;
}

export type InvitationEvent = {
	title: string;
	date: Date;
	status: EventStatus;
	/** Set for invite-only events: the link must carry it. */
	inviteToken: string | null;
};

/** What an invitation e-mail needs, read when it is sent (so it carries the current link). */
export async function getInvitationEvent(
	eventId: string,
): Promise<InvitationEvent | null> {
	const [row] = await db
		.select({
			title: events.title,
			date: events.date,
			status: events.status,
			visibility: events.visibility,
			inviteToken: events.inviteToken,
		})
		.from(events)
		.where(eq(events.id, eventId));
	if (!row) {
		return null;
	}
	return {
		title: row.title,
		date: row.date,
		status: row.status,
		inviteToken: row.visibility === "private" ? row.inviteToken : null,
	};
}

export type EventAccess = {
	visibility: EventVisibility;
	inviteToken: string | null;
	/** The user holds a registration that was not declined (always false without a user). */
	hasRegistration: boolean;
};

/** What decides who may open an event (server-side only: carries the invite secret). */
export async function getEventAccess(
	eventId: string,
	userId?: string,
): Promise<EventAccess | null> {
	const [row] = await db
		.select({
			visibility: events.visibility,
			inviteToken: events.inviteToken,
			hasRegistration: userId
				? sql<boolean>`exists (select 1 from event_registrations r where r.event_id = "events"."id" and r.user_id = ${userId} and r.state <> 'rejected')`
				: sql<boolean>`false`,
		})
		.from(events)
		.where(eq(events.id, eventId));
	return row ?? null;
}

export type UpdateEventInput = {
	id: string;
	groupDeadlineHours?: number;
	title?: string;
	description?: string | null;
	date?: Date;
	endsAt?: Date | null;
	maxSeats?: number;
	typeId?: string;
	locationId?: string | null;
	facultyId?: string | null;
	onlineUrl?: string | null;
	attendanceMode?: AttendanceMode;
	visibility?: EventVisibility;
	room?: string | null;
	reminderHoursBefore?: number | null;
	requiresApproval?: boolean;
	certificatesEnabled?: boolean;
	certificateIssuer?: string | null;
	certificateSigner?: string | null;
	certificateNote?: string | null;
};

/** Updates an event; raising the limit promotes waitlisted people into the new places. */
export async function updateEvent(
	input: UpdateEventInput,
	hooks?: RegistrationHooks,
) {
	const { id, ...values } = input;
	try {
		return await db.transaction(async (tx) => {
			const locked = await lockEvent(tx, id);
			// A cancelled event is history: no edits, so no promotions or e-mails either.
			if (locked?.status === "cancelled") {
				throw new DomainError("EVENT_CANCELLED");
			}
			if (values.maxSeats !== undefined) {
				const [largest] = await tx
					.select({ maxSeats: max(agendaItems.maxSeats) })
					.from(agendaItems)
					.where(eq(agendaItems.eventId, id));
				if (largest?.maxSeats != null && largest.maxSeats > values.maxSeats) {
					throw new DomainError("ITEM_LIMIT_ABOVE_EVENT");
				}
			}
			const before = await readWhenWhere(tx, id);
			const dateMoved =
				values.date !== undefined &&
				before !== null &&
				values.date.getTime() !== before.date.getTime();
			// A new date gets a new reminder, unless its reminder time has already passed.
			const reminderHours =
				values.reminderHoursBefore !== undefined
					? values.reminderHoursBefore
					: (before?.reminderHoursBefore ?? null);
			const rearmReminder =
				dateMoved &&
				values.date !== undefined &&
				reminderHours !== null &&
				values.date.getTime() - reminderHours * 3_600_000 > Date.now();
			const [event] = await tx
				.update(events)
				.set({
					...values,
					// Invite-only needs a link (an existing one stays valid); leaving it revokes the link.
					...(values.visibility === "private"
						? {
								inviteToken: sql`coalesce(${events.inviteToken}, ${newInviteToken()})`,
							}
						: values.visibility !== undefined
							? { inviteToken: null }
							: {}),
					...(rearmReminder ? { reminderSentAt: null } : {}),
					updatedAt: new Date(),
				})
				.where(eq(events.id, id))
				.returning();
			if (event && values.maxSeats !== undefined) {
				await promoteAndNotify(tx, id, hooks);
			}
			if (
				event &&
				before &&
				locked?.status === "published" &&
				hooks?.onEventChanged &&
				// Fixing a past event's details tells nobody.
				!(await hasEventEnded(tx, id))
			) {
				const after = await readWhenWhere(tx, id);
				if (
					after &&
					(after.date.getTime() !== before.date.getTime() ||
						after.place !== before.place)
				) {
					const people = await tx
						.select({ id: eventRegistrations.id })
						.from(eventRegistrations)
						.where(
							and(
								eq(eventRegistrations.eventId, id),
								ne(eventRegistrations.state, "rejected"),
							),
						);
					if (people.length > 0) {
						await hooks.onEventChanged(tx, {
							eventId: id,
							registrationIds: people.map((row) => row.id),
							before: { date: before.date, place: before.place },
							after: { date: after.date, place: after.place },
						});
					}
				}
			}
			return event ?? null;
		});
	} catch (error) {
		mapConstraintError(error, CAPACITY_EDIT_ERRORS);
	}
}

export async function deleteEvent(id: string) {
	const [event] = await db
		.delete(events)
		.where(eq(events.id, id))
		.returning({ id: events.id });
	return event ?? null;
}

export type EventDetails = EventWithRelations & {
	agenda: AgendaItem[];
	questions: EventQuestion[];
};

export async function getEventById(
	id: string,
	audience: EventAudience,
): Promise<EventDetails | null> {
	const [[event], agenda, questions] = await Promise.all([
		queryEvents({ audience }, id),
		listAgendaItems(id),
		listEventQuestions(id),
	]);
	return event ? { ...event, agenda, questions } : null;
}

/** Makes a draft public. EVENT_INCOMPLETE without a place or link; EVENT_NOT_DRAFT if already public. */
export async function publishEvent(
	eventId: string,
): Promise<EventWithRelations> {
	await db.transaction(async (tx) => {
		if (!(await lockEvent(tx, eventId))) {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		const [event] = await tx
			.select({
				status: events.status,
				attendanceMode: events.attendanceMode,
				locationId: events.locationId,
				onlineUrl: events.onlineUrl,
				room: events.room,
			})
			.from(events)
			.where(eq(events.id, eventId));
		if (!event) {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		if (event.status !== "draft") {
			throw new DomainError("EVENT_NOT_DRAFT");
		}
		if (missingForPublish(event).length > 0) {
			throw new DomainError("EVENT_INCOMPLETE");
		}
		const now = new Date();
		await tx
			.update(events)
			.set({ status: "published", publishedAt: now, updatedAt: now })
			.where(eq(events.id, eventId));
	});
	const [published] = await queryEvents(
		{ audience: { kind: "manage" } },
		eventId,
	);
	if (!published) {
		throw new DomainError("EVENT_NOT_FOUND");
	}
	return published;
}

/**
 * Cancels a published event: registration closes, open groups close, and every
 * registered or waitlisted person is reported (for the cancellation e-mail).
 * Registrations stay as the event's history. Irreversible.
 */
export async function cancelEvent(
	eventId: string,
	hooks?: RegistrationHooks,
): Promise<{ txid: number }> {
	return db.transaction(async (tx) => {
		if (!(await lockEvent(tx, eventId))) {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		const [event] = await tx
			.select({ status: events.status })
			.from(events)
			.where(eq(events.id, eventId));
		if (!event || event.status === "draft") {
			throw new DomainError("EVENT_NOT_FOUND");
		}
		if (event.status === "cancelled") {
			throw new DomainError("EVENT_ALREADY_CANCELLED");
		}
		if (await hasEventEnded(tx, eventId)) {
			throw new DomainError("EVENT_ENDED");
		}
		const now = new Date();
		await tx
			.update(events)
			.set({ status: "cancelled", cancelledAt: now, updatedAt: now })
			.where(eq(events.id, eventId));
		// Lock order: the event row is held, groups come next.
		await tx
			.update(registrationGroups)
			.set({ status: "closed", updatedAt: now })
			.where(
				and(
					eq(registrationGroups.eventId, eventId),
					eq(registrationGroups.status, "open"),
				),
			);
		const people = await tx
			.select({ id: eventRegistrations.id })
			.from(eventRegistrations)
			.where(
				and(
					eq(eventRegistrations.eventId, eventId),
					ne(eventRegistrations.state, "rejected"),
				),
			)
			.orderBy(asc(eventRegistrations.createdAt), asc(eventRegistrations.id));
		await notify(
			tx,
			hooks,
			people.map((row) => ({ registrationId: row.id, change: "cancelled" })),
		);
		return { txid: await getCurrentTxId(tx) };
	});
}

/** The meeting link of an event (show it only to registered people). */
export async function getEventOnlineUrl(
	eventId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ onlineUrl: events.onlineUrl })
		.from(events)
		.where(eq(events.id, eventId));
	return row?.onlineUrl ?? null;
}

export async function getEventStatus(
	eventId: string,
): Promise<EventStatus | null> {
	const [row] = await db
		.select({ status: events.status })
		.from(events)
		.where(eq(events.id, eventId));
	return row?.status ?? null;
}

/** An event's date and readable place ("Aula · B105"), read inside a transaction. */
async function readWhenWhere(
	tx: TransactionClient,
	eventId: string,
): Promise<(EventWhenWhere & { reminderHoursBefore: number | null }) | null> {
	const [row] = await tx
		.select({
			date: events.date,
			reminderHoursBefore: events.reminderHoursBefore,
			location: eventLocations.label,
			room: events.room,
		})
		.from(events)
		.leftJoin(eventLocations, eq(eventLocations.id, events.locationId))
		.where(eq(events.id, eventId));
	if (!row) {
		return null;
	}
	const place = [row.location, row.room].filter(Boolean).join(" · ");
	return {
		date: row.date,
		place: place || null,
		reminderHoursBefore: row.reminderHoursBefore,
	};
}
