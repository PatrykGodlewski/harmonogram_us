import { asc, eq, ilike, or } from "drizzle-orm";
import { db } from "../client";
import { authUsers } from "../schema/better-auth";

export type UserRole = "user" | "organizer" | "admin";

export async function getUserRole(userId: string): Promise<UserRole | null> {
	const [row] = await db
		.select({ role: authUsers.role })
		.from(authUsers)
		.where(eq(authUsers.id, userId));
	if (!row) {
		return null;
	}
	return row.role === "admin" || row.role === "organizer" ? row.role : "user";
}

export async function isAdmin(userId: string): Promise<boolean> {
	return (await getUserRole(userId)) === "admin";
}

export type UserListItem = {
	id: string;
	email: string;
	name: string;
	role: UserRole;
};

const userListColumns = {
	id: authUsers.id,
	email: authUsers.email,
	name: authUsers.name,
	role: authUsers.role,
};

function toUserListItem(row: {
	id: string;
	email: string;
	name: string;
	role: string;
}): UserListItem {
	return { ...row, role: row.role as UserRole };
}

/** Users whose e-mail or name contains `query` (any case), by e-mail; an empty query lists the first ones. */
export async function searchUsers(
	query: string,
	limit: number,
): Promise<UserListItem[]> {
	const term = query.trim();
	const pattern = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
	const rows = await db
		.select(userListColumns)
		.from(authUsers)
		.where(
			term
				? or(ilike(authUsers.email, pattern), ilike(authUsers.name, pattern))
				: undefined,
		)
		.orderBy(asc(authUsers.email))
		.limit(limit);
	return rows.map(toUserListItem);
}

export async function setUserRole(
	userId: string,
	role: UserRole,
): Promise<UserListItem | null> {
	const [row] = await db
		.update(authUsers)
		.set({ role, updatedAt: new Date() })
		.where(eq(authUsers.id, userId))
		.returning(userListColumns);
	return row ? toUserListItem(row) : null;
}
