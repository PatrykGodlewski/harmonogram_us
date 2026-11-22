import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";

export async function findUserById(id: string) {
	const [user] = await db.select().from(authUsers).where(eq(authUsers.id, id));
	return user ?? null;
}

export async function findUserByEmail(email: string) {
	const [user] = await db
		.select()
		.from(authUsers)
		.where(eq(authUsers.email, email));
	return user ?? null;
}

export async function createUser(email: string, _password: string) {
	const [user] = await db
		.insert(authUsers)
		.values({
			id: crypto.randomUUID(),
			email,
			name: email,
			emailVerified: false,
		})
		.returning();
	return user;
}

/** An account by e-mail, ignoring case and surrounding spaces (what people type). */
export async function findAccountByEmail(
	email: string,
): Promise<{ id: string; email: string; name: string } | null> {
	const [user] = await db
		.select({ id: authUsers.id, email: authUsers.email, name: authUsers.name })
		.from(authUsers)
		.where(eq(sql`lower(${authUsers.email})`, email.trim().toLowerCase()));
	return user ?? null;
}

export type Profile = { name: string; locale: "pl" | "en" | null };

export async function getProfile(userId: string): Promise<Profile | null> {
	const [row] = await db
		.select({ name: authUsers.name, locale: authUsers.locale })
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	return row ?? null;
}

/** Saves the profile name and language (the language of the person's e-mails from now on). */
export async function updateProfile(
	userId: string,
	profile: { name: string; locale: "pl" | "en" },
): Promise<void> {
	await db
		.update(authUsers)
		.set({ name: profile.name, locale: profile.locale, updatedAt: new Date() })
		.where(eq(authUsers.id, userId));
}
