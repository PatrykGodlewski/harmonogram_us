import { verifyPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { authUsers } from "../src/schema/better-auth";
import { accountSeeds, FULL_EVENT_ID, groupSeeds } from "../src/seed/data";
import { seedDatabase } from "../src/seed/seed";
import { credentialHash, resetDb } from "./helpers";

beforeEach(resetDb);

const PASSWORD = "Seed-Test-Haslo-2026!";

async function counts() {
	const [row] = await db.execute<{ events: number; registrations: number; waitlisted: number; groups: number; users: number }>(sql`
		SELECT
			(SELECT count(*)::int FROM events) AS events,
			(SELECT count(*)::int FROM event_registrations) AS registrations,
			(SELECT count(*)::int FROM event_registrations WHERE event_id = ${FULL_EVENT_ID} AND state = 'waitlisted') AS waitlisted,
			(SELECT count(*)::int FROM registration_groups) AS groups,
			(SELECT count(*)::int FROM "user") AS users
	`);
	return row;
}

describe("seedDatabase", () => {
	it("seeds events, accounts, registrations with a waitlist and a group, and is idempotent", async () => {
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		const first = await counts();
		expect(first?.events).toBeGreaterThanOrEqual(10);
		expect(first?.users).toBe(accountSeeds.length);
		expect(first?.waitlisted).toBeGreaterThan(0);
		expect(first?.groups).toBe(groupSeeds.length);
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		expect(await counts()).toEqual(first);
	});

	it("accounts with a password can sign in with it; the admin is an admin", async () => {
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		const admin = accountSeeds.find((account) => account.role === "admin");
		const [user] = await db.select().from(authUsers).where(eq(authUsers.email, admin?.email ?? ""));
		expect(user?.role).toBe("admin");
		expect(await verifyPassword({ hash: await credentialHash(user?.id ?? ""), password: PASSWORD })).toBe(true);
	});

	it("gives every event an agenda that starts with the event and falls on its day", async () => {
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		const rows = await db.execute<{ id: string; items: number; same_day: boolean; starts_with_event: boolean }>(sql`
			SELECT e.id,
				count(a.id)::int AS items,
				coalesce(bool_and(a.starts_at::date = e.date::date), true) AS same_day,
				coalesce(min(a.starts_at) = e.date, false) AS starts_with_event
			FROM events e LEFT JOIN agenda_items a ON a.event_id = e.id
			GROUP BY e.id
		`);
		for (const row of rows) {
			expect(row, row.id).toMatchObject({ same_day: true, starts_with_event: true });
			expect(row.items, row.id).toBeGreaterThanOrEqual(2);
		}
	});

	it("seeds groups with accepted members, agenda items and a closed group", async () => {
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		const [row] = await db.execute<{ accepted: number; closed: number; with_items: number }>(sql`
			SELECT
				(SELECT count(*)::int FROM registration_group_members WHERE status = 'confirmed') AS accepted,
				(SELECT count(*)::int FROM registration_groups WHERE status <> 'open') AS closed,
				(SELECT count(DISTINCT group_id)::int FROM registration_group_items) AS with_items
		`);
		const expectedAccepted = groupSeeds.reduce((sum, group) => sum + group.accept.length, 0);
		expect(row).toEqual({
			accepted: expectedAccepted,
			closed: groupSeeds.filter((group) => group.close).length,
			with_items: groupSeeds.filter((group) => group.itemIds.length > 0).length,
		});
	});

	it("refuses to run in production", async () => {
		await expect(seedDatabase({ password: PASSWORD, nodeEnv: "production" })).rejects.toThrow(
			"Refusing to seed a production database",
		);
	});
});
