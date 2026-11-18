import { eq } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";

export type UserRole = "user" | "admin";

export async function getUserRole(userId: string): Promise<UserRole | null> {
	const [row] = await db
		.select({ role: authUsers.role })
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	if (!row) {
		return null;
	}
	return row.role === "admin" ? "admin" : "user";
}

export async function isAdmin(userId: string): Promise<boolean> {
	return (await getUserRole(userId)) === "admin";
}
