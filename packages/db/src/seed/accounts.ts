import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { authAccounts, authUsers } from "../schema/better-auth";

export type AccountRole = "user" | "admin";

/** Minimum length of a test-account password (seed, CLI). */
export const MIN_ACCOUNT_PASSWORD_LENGTH = 12;

type AccountInput = {
	email: string;
	name: string;
	role?: AccountRole;
	/** Omit for an account that signs in only with e-mail links. */
	password?: string;
};

/**
 * Creates or updates a verified account (seed data, local test accounts, e2e fixtures).
 * Idempotent per e-mail: name, role and password are brought to the given values.
 */
export async function ensureAccount(
	input: AccountInput,
): Promise<{ id: string; created: boolean }> {
	const email = input.email.trim().toLowerCase();
	const role = input.role ?? "user";
	const passwordHash = input.password
		? await hashPassword(input.password)
		: null;

	return db.transaction(async (tx) => {
		const [existing] = await tx
			.select({ id: authUsers.id })
			.from(authUsers)
			.where(eq(authUsers.email, email))
			.for("update");
		const id = existing?.id ?? crypto.randomUUID();
		if (existing) {
			await tx
				.update(authUsers)
				.set({
					name: input.name,
					role,
					emailVerified: true,
					updatedAt: new Date(),
				})
				.where(eq(authUsers.id, id));
		} else {
			await tx
				.insert(authUsers)
				.values({ id, email, name: input.name, role, emailVerified: true });
		}

		if (passwordHash) {
			const updated = await tx
				.update(authAccounts)
				.set({ password: passwordHash, updatedAt: new Date() })
				.where(
					and(
						eq(authAccounts.userId, id),
						eq(authAccounts.providerId, "credential"),
					),
				)
				.returning({ id: authAccounts.id });
			if (updated.length === 0) {
				await tx.insert(authAccounts).values({
					id: crypto.randomUUID(),
					userId: id,
					providerId: "credential",
					accountId: id,
					password: passwordHash,
				});
			}
		}
		return { id, created: !existing };
	});
}
