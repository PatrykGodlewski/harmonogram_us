import { eq } from "drizzle-orm";
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
