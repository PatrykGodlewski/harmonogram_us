import { eq } from 'drizzle-orm';
import { db } from '../client';
import { users } from '../schema/users';

export async function findUserById(id: number) {
	const [user] = await db.select().from(users).where(eq(users.id, id));
	return user ?? null;
}

export async function findUserByEmail(email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, email));
	return user ?? null;
}

export async function createUser(email: string, password: string) {
	const [user] = await db
		.insert(users)
		.values({ email, password })
		.returning();
	return user;
}
