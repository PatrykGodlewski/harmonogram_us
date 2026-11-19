import { verifyPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { ensureAccount } from "../src/seed/accounts";
import { authAccounts, authUsers } from "../src/schema/better-auth";
import { credentialHash, resetDb } from "./helpers";

beforeEach(resetDb);

describe("ensureAccount", () => {
	it("creates a verified account that can sign in with the password", async () => {
		const { id, created } = await ensureAccount({
			email: "New@X.test",
			name: "Nowa Osoba",
			role: "admin",
			password: "Haslo-Testowe-123!",
		});
		expect(created).toBe(true);
		const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
		expect(user).toMatchObject({ email: "new@x.test", name: "Nowa Osoba", role: "admin", emailVerified: true });
		expect(await verifyPassword({ hash: await credentialHash(id), password: "Haslo-Testowe-123!" })).toBe(true);
	});

	it("is idempotent: a second call updates name, role and password on the same account", async () => {
		const first = await ensureAccount({ email: "a@x.test", name: "A", password: "Pierwsze-Haslo-1!" });
		const second = await ensureAccount({ email: "a@x.test", name: "A2", role: "admin", password: "Drugie-Haslo-2!" });
		expect(second).toEqual({ id: first.id, created: false });
		const users = await db.select().from(authUsers).where(eq(authUsers.email, "a@x.test"));
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({ name: "A2", role: "admin" });
		const accounts = await db.select().from(authAccounts).where(eq(authAccounts.userId, first.id));
		expect(accounts).toHaveLength(1);
		expect(await verifyPassword({ hash: await credentialHash(first.id), password: "Drugie-Haslo-2!" })).toBe(true);
	});

	it("without a password creates an e-mail-link account (no credential)", async () => {
		const { id } = await ensureAccount({ email: "link@x.test", name: "Link" });
		expect(await credentialHash(id)).toBe("");
	});
});
