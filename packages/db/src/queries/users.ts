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
