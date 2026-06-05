import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { authAccounts, authUsers } from "../schema/better-auth";
import {
	eventFaculties,
	eventLocations,
	eventTypes,
} from "../schema/event-lookups";
import { eventSeatCounts } from "../schema/event-registrations";
import { events } from "../schema/events";
import {
	adminUserSeed,
	eventFacultySeeds,
	eventLocationSeeds,
	eventSeeds,
	eventTypeSeeds,
	type LookupSeed,
} from "./data";

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

async function upsertLookups<T extends LookupSeed>(
	table: typeof eventTypes | typeof eventLocations | typeof eventFaculties,
	rows: T[],
) {
	if (rows.length === 0) {
		return;
	}

	await db
		.insert(table)
		.values(rows)
		.onConflictDoUpdate({
			target: table.id,
			set: {
				slug: sql`excluded.slug`,
				label: sql`excluded.label`,
				sortOrder: sql`excluded.sort_order`,
				updatedAt: new Date(),
			},
		});
}

export async function seedEventLookups() {
	await upsertLookups(eventTypes, eventTypeSeeds);
	await upsertLookups(eventLocations, eventLocationSeeds);
	await upsertLookups(eventFaculties, eventFacultySeeds);
}

export async function seedSampleEvents() {
	const now = new Date();

	for (const event of eventSeeds) {
		await db
			.insert(events)
			.values({
				id: event.id,
				title: event.title,
				date: addDays(now, event.daysFromNow),
				maxSeats: event.maxSeats,
				typeId: event.typeId,
				locationId: event.locationId,
				facultyId: event.facultyId,
			})
			.onConflictDoUpdate({
				target: events.id,
				set: {
					title: sql`excluded.title`,
					date: sql`excluded.date`,
					maxSeats: sql`excluded.max_seats`,
					typeId: sql`excluded.type_id`,
					locationId: sql`excluded.location_id`,
					facultyId: sql`excluded.faculty_id`,
					updatedAt: new Date(),
				},
			});

		await db
			.insert(eventSeatCounts)
			.values({
				eventId: event.id,
				seatsRemaining: event.maxSeats,
				maxSeats: event.maxSeats,
			})
			.onConflictDoUpdate({
				target: eventSeatCounts.eventId,
				set: {
					maxSeats: sql`excluded.max_seats`,
					seatsRemaining: sql`excluded.seats_remaining`,
					updatedAt: new Date(),
				},
			});
	}
}

export async function seedAdminUser() {
	const email = adminUserSeed.email;
	const passwordHash = await hashPassword(adminUserSeed.password);

	const [existingUser] = await db
		.select({ id: authUsers.id })
		.from(authUsers)
		.where(eq(authUsers.email, email))
		.limit(1);

	const userId = existingUser?.id ?? adminUserSeed.id;

	if (!existingUser) {
		await db.insert(authUsers).values({
			id: userId,
			email,
			name: adminUserSeed.name,
			emailVerified: true,
		});
	}

	const [existingAccount] = await db
		.select({ id: authAccounts.id })
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.userId, userId),
				eq(authAccounts.providerId, "credential"),
			),
		)
		.limit(1);

	if (existingAccount) {
		return;
	}

	await db.insert(authAccounts).values({
		id: crypto.randomUUID(),
		userId,
		providerId: "credential",
		accountId: userId,
		password: passwordHash,
	});
}

export async function seedDatabase() {
	await seedEventLookups();
	await seedSampleEvents();
	await seedAdminUser();
}
