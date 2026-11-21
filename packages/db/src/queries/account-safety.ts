import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "../schema/better-auth";

/**
 * Before an email is proven through another channel (invitation or magic link),
 * an unverified account may have been created by someone else with a password.
 * Remove its password and sessions, and give it a new calendar feed address, so nobody
 * else keeps access. Returns whether it reset.
 */
export async function resetUnverifiedAccount(userId: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const [user] = await tx
			.select({ emailVerified: authUsers.emailVerified })
			.from(authUsers)
			.where(eq(authUsers.id, userId))
			.for("update");
		if (!user || user.emailVerified) {
			return false;
		}
		await tx
			.delete(authAccounts)
			.where(
				and(
					eq(authAccounts.userId, userId),
					eq(authAccounts.providerId, "credential"),
				),
			);
		await tx.delete(authSessions).where(eq(authSessions.userId, userId));
		await tx
			.update(authUsers)
			.set({
				calendarToken: sql`replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`,
			})
			.where(eq(authUsers.id, userId));
		return true;
	});
}

/**
 * Email behind a Better Auth magic-link token. The plugin (storeToken: "hashed")
 * stores base64url(sha256(token)) as the verification identifier.
 */
export async function findMagicLinkEmail(
	token: string,
): Promise<string | null> {
	const identifier = createHash("sha256").update(token).digest("base64url");
	const [row] = await db
		.select({ value: authVerifications.value })
		.from(authVerifications)
		.where(eq(authVerifications.identifier, identifier));
	if (!row) {
		return null;
	}
	try {
		const value: unknown = JSON.parse(row.value);
		if (value && typeof value === "object" && "email" in value) {
			const email = (value as { email: unknown }).email;
			return typeof email === "string" ? email.toLowerCase() : null;
		}
		return null;
	} catch {
		return null;
	}
}

/** Whether the user already signs in through this provider (e.g. the university). */
export async function hasProviderAccount(
	userId: string,
	providerId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: authAccounts.id })
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.userId, userId),
				eq(authAccounts.providerId, providerId),
			),
		)
		.limit(1);
	return Boolean(row);
}
