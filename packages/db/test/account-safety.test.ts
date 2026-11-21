import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	findMagicLinkEmail,
	resetUnverifiedAccount,
} from "../src/queries/account-safety";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "../src/schema/better-auth";
import { createUser, resetDb } from "./helpers";

beforeEach(async () => {
	await resetDb();
	await db.delete(authVerifications);
});

async function seedPasswordAndSession(userId: string) {
	await db.insert(authAccounts).values({
		id: crypto.randomUUID(),
		accountId: userId,
		providerId: "credential",
		userId,
		password: "hash",
	});
	await db.insert(authSessions).values({
		id: crypto.randomUUID(),
		token: crypto.randomUUID(),
		userId,
		expiresAt: new Date(Date.now() + 86_400_000),
	});
}

async function counts(userId: string) {
	const accounts = await db.select().from(authAccounts).where(eq(authAccounts.userId, userId));
	const sessions = await db.select().from(authSessions).where(eq(authSessions.userId, userId));
	return { accounts: accounts.length, sessions: sessions.length };
}

describe("account safety", () => {
	it("resetUnverifiedAccount wipes password and sessions of unverified user only", async () => {
		const unverified = await createUser();
		await db.update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, unverified));
		const verified = await createUser();
		await seedPasswordAndSession(unverified);
		await seedPasswordAndSession(verified);

		expect(await resetUnverifiedAccount(unverified)).toBe(true);
		expect(await resetUnverifiedAccount(verified)).toBe(false);
		expect(await counts(unverified)).toEqual({ accounts: 0, sessions: 0 });
		expect(await counts(verified)).toEqual({ accounts: 1, sessions: 1 });
	});

	it("resetUnverifiedAccount drops the calendar feed a stranger could have copied", async () => {
		const unverified = await createUser();
		await db
			.update(authUsers)
			.set({ emailVerified: false, calendarToken: "copied-by-stranger" })
			.where(eq(authUsers.id, unverified));

		await resetUnverifiedAccount(unverified);

		const [user] = await db
			.select({ calendarToken: authUsers.calendarToken })
			.from(authUsers)
			.where(eq(authUsers.id, unverified));
		expect(user?.calendarToken).not.toBe("copied-by-stranger");
	});

	it("findMagicLinkEmail resolves the hashed identifier (Better Auth 1.7 format)", async () => {
		const hash = createHash("sha256").update("tok").digest("base64url");
		await db.insert(authVerifications).values({
			id: crypto.randomUUID(),
			identifier: `magic-link:${hash}`,
			value: JSON.stringify({ type: "magic-link", email: "A@x.test" }),
			expiresAt: new Date(Date.now() + 60_000),
		});
		expect(await findMagicLinkEmail("tok")).toBe("a@x.test");
		expect(await findMagicLinkEmail("other")).toBeNull();
	});
});
