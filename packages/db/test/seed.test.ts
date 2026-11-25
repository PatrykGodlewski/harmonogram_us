import { verifyPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { effectiveEventEndSql } from "../src/queries/event-registrations";
import { authUsers } from "../src/schema/better-auth";
import { events } from "../src/schema/events";
import {
	accountSeeds,
	APPROVAL_EVENT_ID,
	CANCELLED_EVENT_ID,
	CERTIFICATE_EVENT_ID,
	DRAFT_EVENT_ID,
	groupSeeds,
	INVITE_EVENT_ID,
	LAST_SEAT_EVENT_ID,
	LIVE_NOW_EVENT_ID,
	WAITLIST_EVENT_ID,
} from "../src/seed/data";
import {
	FESTIVAL_EVENT_ID,
	FULL_FESTIVAL_ITEM_ID,
} from "../src/seed/festival";
import { participantAccountSeeds } from "../src/seed/participants";
import { seedDatabase } from "../src/seed/seed";
import { credentialHash, resetDb } from "./helpers";

const PASSWORD = "Seed-Test-Haslo-2026!";
/** One seed run takes several seconds (thousands of registrations through the domain functions). */
const SEED_TIMEOUT = 60_000;

async function counts() {
	const [row] = await db.execute<{
		events: number;
		registrations: number;
		waitlisted: number;
		items: number;
		groups: number;
		users: number;
	}>(sql`
		SELECT
			(SELECT count(*)::int FROM events) AS events,
			(SELECT count(*)::int FROM event_registrations) AS registrations,
			(SELECT count(*)::int FROM event_registrations WHERE state = 'waitlisted') AS waitlisted,
			(SELECT count(*)::int FROM agenda_item_registrations) AS items,
			(SELECT count(*)::int FROM registration_groups) AS groups,
			(SELECT count(*)::int FROM "user") AS users
	`);
	return row;
}

async function seatsRemaining(eventId: string): Promise<number | undefined> {
	const [row] = await db.execute<{ seats: number }>(
		sql`SELECT seats_remaining AS seats FROM event_seat_counts WHERE event_id = ${eventId}`,
	);
	return row?.seats;
}

async function registrationStates(eventId: string) {
	const [row] = await db.execute<{ registered: number; waitlisted: number }>(sql`
		SELECT count(*) FILTER (WHERE state = 'registered')::int AS registered,
			count(*) FILTER (WHERE state = 'waitlisted')::int AS waitlisted
		FROM event_registrations WHERE event_id = ${eventId}
	`);
	return row;
}

describe("seedDatabase", () => {
	// The checks below only read: seed once for all of them.
	beforeAll(async () => {
		await resetDb();
		// Left over from the old bulk generator: a re-seed removes it.
		await db.insert(events).values({
			id: "gen-001",
			title: "Stare wydarzenie",
			date: new Date(),
			maxSeats: 5,
			typeId: await insertType(),
		});
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
	}, SEED_TIMEOUT);

	it(
		"is idempotent",
		async () => {
			const first = await counts();
			await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
			expect(await counts()).toEqual(first);
		},
		SEED_TIMEOUT,
	);

	it("seeds a few showcase events, the test accounts and the participants", async () => {
		const total = await counts();
		expect(total?.users).toBe(
			accountSeeds.length + participantAccountSeeds.length,
		);
		expect(total?.events).toBeGreaterThanOrEqual(8);
		expect(total?.events).toBeLessThanOrEqual(12);
		const [old] = await db.execute<{ n: number }>(
			sql`SELECT count(*)::int AS n FROM events WHERE id = 'gen-001'`,
		);
		expect(old?.n).toBe(0);
	});

	it("gives the festival a programme like a science festival's", async () => {
		const [row] = await db.execute<{
			items: number;
			sessions: number;
			days: number;
			parallel: number;
			detailed: number;
			bios: number;
			open: number;
			outside_session: number;
		}>(sql`
			SELECT
				(SELECT count(*)::int FROM agenda_items WHERE event_id = ${FESTIVAL_EVENT_ID}) AS items,
				(SELECT count(*)::int FROM agenda_sessions WHERE event_id = ${FESTIVAL_EVENT_ID}) AS sessions,
				(SELECT count(DISTINCT (starts_at AT TIME ZONE 'Europe/Warsaw')::date)::int
					FROM agenda_items WHERE event_id = ${FESTIVAL_EVENT_ID}) AS days,
				(SELECT count(*)::int FROM agenda_items a JOIN agenda_items b
					ON a.event_id = b.event_id AND a.id < b.id
					AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at
					WHERE a.event_id = ${FESTIVAL_EVENT_ID}) AS parallel,
				(SELECT count(*)::int FROM agenda_items WHERE event_id = ${FESTIVAL_EVENT_ID}
					AND type_id IS NOT NULL AND topic IS NOT NULL AND audience IS NOT NULL
					AND cardinality(languages) > 0) AS detailed,
				(SELECT count(*)::int FROM agenda_items WHERE event_id = ${FESTIVAL_EVENT_ID}
					AND speakers @> '[{}]' AND speakers::text LIKE '%"bio"%') AS bios,
				(SELECT count(*)::int FROM agenda_items WHERE event_id = ${FESTIVAL_EVENT_ID}
					AND NOT requires_registration) AS open,
				(SELECT count(*)::int FROM agenda_items a JOIN agenda_sessions s ON s.id = a.session_id
					WHERE a.event_id = ${FESTIVAL_EVENT_ID}
					AND (a.starts_at < s.starts_at OR a.ends_at > s.ends_at)) AS outside_session
		`);
		expect(row?.items).toBeGreaterThanOrEqual(50);
		expect(row?.sessions).toBeGreaterThanOrEqual(10);
		expect(row?.days).toBe(3);
		expect(row?.parallel).toBeGreaterThan(20);
		expect(row?.detailed).toBe(row?.items);
		expect(row?.bios).toBeGreaterThan(10);
		expect(row?.open).toBeGreaterThan(0);
		expect(row?.outside_session).toBe(0);

		const [full] = await db.execute<{ seats: number }>(sql`
			SELECT seats_remaining AS seats FROM agenda_item_seat_counts
			WHERE agenda_item_id = ${FULL_FESTIVAL_ITEM_ID}
		`);
		expect(full?.seats).toBe(0);
	});

	it(
		"a re-seed removes programme parts no longer in the set",
		async () => {
			await db.execute(sql`
				INSERT INTO agenda_items (id, event_id, title, starts_at, ends_at)
				SELECT 'agenda-old', id, 'Stary punkt', date, date + interval '1 hour'
				FROM events WHERE id = ${FESTIVAL_EVENT_ID}
			`);
			await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
			const [row] = await db.execute<{ n: number }>(
				sql`SELECT count(*)::int AS n FROM agenda_items WHERE id = 'agenda-old'`,
			);
			expect(row?.n).toBe(0);
		},
		SEED_TIMEOUT,
	);

	it("has a cancelled event and a draft", async () => {
		const rows = await db.execute<{ id: string; status: string }>(sql`
			SELECT id, status FROM events WHERE id IN (${CANCELLED_EVENT_ID}, ${DRAFT_EVENT_ID}) ORDER BY id
		`);
		expect(Object.fromEntries(rows.map((row) => [row.id, row.status]))).toEqual({
			[CANCELLED_EVENT_ID]: "cancelled",
			[DRAFT_EVENT_ID]: "draft",
		});
	});

	it("accounts with a password can sign in with it; the admin is an admin", async () => {
		const admin = accountSeeds.find((account) => account.role === "admin");
		const [user] = await db
			.select()
			.from(authUsers)
			.where(eq(authUsers.email, admin?.email ?? ""));
		expect(user?.role).toBe("admin");
		expect(
			await verifyPassword({
				hash: await credentialHash(user?.id ?? ""),
				password: PASSWORD,
			}),
		).toBe(true);
	});

	it("keeps every agenda inside its event, starting when the event starts", async () => {
		const rows = await db.execute<{
			id: string;
			starts_with_event: boolean;
			inside: boolean;
		}>(sql`
			SELECT e.id,
				min(a.starts_at) = e.date AS starts_with_event,
				bool_and(a.starts_at >= e.date AND a.ends_at <= ${effectiveEventEndSql(sql`e`)}) AS inside
			FROM events e JOIN agenda_items a ON a.event_id = e.id
			GROUP BY e.id
		`);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row, row.id).toMatchObject({
				starts_with_event: true,
				inside: true,
			});
		}
	});

	it("sets up the showcase states: last seat, a waitlist, on now, attendance", async () => {
		expect(await seatsRemaining(LAST_SEAT_EVENT_ID)).toBe(1);
		expect(await registrationStates(WAITLIST_EVENT_ID)).toEqual({
			registered: 15,
			waitlisted: 12,
		});

		const [live] = await db.execute<{ on_now: boolean }>(sql`
			SELECT date <= now() AND ends_at > now() AS on_now FROM events WHERE id = ${LIVE_NOW_EVENT_ID}
		`);
		expect(live?.on_now).toBe(true);

		// Registrations of an ended event stay as its attendance record, and its dates are restored.
		const [past] = await db.execute<{ ended: boolean }>(sql`
			SELECT ends_at < now() AS ended FROM events WHERE id = ${CERTIFICATE_EVENT_ID}
		`);
		expect(past?.ended).toBe(true);
		expect(
			(await registrationStates(CERTIFICATE_EVENT_ID))?.registered,
		).toBeGreaterThan(0);
	});

	it("seeds groups with accepted members, agenda items and a closed group", async () => {
		const [row] = await db.execute<{
			accepted: number;
			closed: number;
			with_items: number;
		}>(sql`
			SELECT
				(SELECT count(*)::int FROM registration_group_members WHERE status = 'confirmed') AS accepted,
				(SELECT count(*)::int FROM registration_groups WHERE status <> 'open') AS closed,
				(SELECT count(DISTINCT group_id)::int FROM registration_group_items) AS with_items
		`);
		const expectedAccepted = groupSeeds.reduce(
			(sum, group) => sum + group.accept.length,
			0,
		);
		expect(row).toEqual({
			accepted: expectedAccepted,
			closed: groupSeeds.filter((group) => group.close).length,
			with_items: groupSeeds.filter((group) => group.itemIds.length > 0).length,
		});
	});

	it("shows plan 4 features: a certificate, waiting requests, an invite-only event, speakers", async () => {
		const { getCertificate } = await import("../src/queries/certificates");
		const [row] = await db.execute<{
			certificate_id: string;
			certificate_user: string;
			pending: number;
			rejected: number;
			private_token: string | null;
			speakers: number;
			organizer_events: number;
		}>(sql`
			SELECT
				(SELECT r.id FROM event_registrations r JOIN "user" u ON u.id = r.user_id
					WHERE r.event_id = ${CERTIFICATE_EVENT_ID} AND u.email = 'student1@harmonogram.local') AS certificate_id,
				(SELECT id FROM "user" WHERE email = 'student1@harmonogram.local') AS certificate_user,
				(SELECT count(*)::int FROM event_registrations WHERE event_id = ${APPROVAL_EVENT_ID} AND state = 'pending') AS pending,
				(SELECT count(*)::int FROM event_registrations WHERE event_id = ${APPROVAL_EVENT_ID} AND state = 'rejected') AS rejected,
				(SELECT invite_token FROM events WHERE id = ${INVITE_EVENT_ID} AND visibility = 'private') AS private_token,
				(SELECT count(*)::int FROM agenda_items WHERE jsonb_array_length(speakers) > 0) AS speakers,
				(SELECT count(*)::int FROM event_organizers o JOIN "user" u ON u.id = o.user_id
					WHERE u.email = 'organizator@harmonogram.local') AS organizer_events
		`);
		expect(row).toMatchObject({ pending: 2, rejected: 1 });
		expect(row?.private_token).toBeTruthy();
		expect(row?.speakers).toBeGreaterThan(0);
		expect(row?.organizer_events).toBeGreaterThanOrEqual(3);
		expect(await getCertificate(row?.certificate_id ?? "", row?.certificate_user ?? "")).not.toBeNull();
	});

	it("refuses to run in production", async () => {
		await expect(
			seedDatabase({ password: PASSWORD, nodeEnv: "production" }),
		).rejects.toThrow("Refusing to seed a production database");
	});
});

async function insertType(): Promise<string> {
	await db.execute(
		sql`INSERT INTO event_types (id, slug, label) VALUES ('old', 'old', 'Old') ON CONFLICT DO NOTHING`,
	);
	return "old";
}
