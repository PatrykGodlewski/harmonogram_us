import { verifyPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { authAccounts, authUsers } from "../src/schema/better-auth";
import { accountSeeds, FULL_EVENT_ID } from "../src/seed/data";
import { seedDatabase } from "../src/seed/seed";
import { resetDb } from "./helpers";

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
		expect(first?.groups).toBe(1);
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		expect(await counts()).toEqual(first);
	});

	it("accounts with a password can sign in with it; the admin is an admin", async () => {
		await seedDatabase({ password: PASSWORD, nodeEnv: "development" });
		const admin = accountSeeds.find((account) => account.role === "admin");
		const [user] = await db.select().from(authUsers).where(eq(authUsers.email, admin?.email ?? ""));
		expect(user?.role).toBe("admin");
		const [account] = await db
			.select({ password: authAccounts.password })
			.from(authAccounts)
			.where(and(eq(authAccounts.userId, user?.id ?? ""), eq(authAccounts.providerId, "credential")));
		expect(await verifyPassword({ hash: account?.password ?? "", password: PASSWORD })).toBe(true);
	});

	it("refuses to run in production", async () => {
		await expect(seedDatabase({ password: PASSWORD, nodeEnv: "production" })).rejects.toThrow(
			"Refusing to seed a production database",
		);
	});
});
