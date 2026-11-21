import { resetUnverifiedAccount } from "@repo/db/queries/account-safety";
import type { AuthContext, User } from "better-auth";

/**
 * The account for an address whose inbox was just proven (an invitation or guest link,
 * like a magic link): verified, with any password a stranger set on it removed, or a new
 * verified passwordless account. Safe against a concurrent confirm creating it first.
 */
export async function ensureVerifiedUser(
	adapter: AuthContext["internalAdapter"],
	email: string,
	name: string,
	method: string,
): Promise<User> {
	let user = (await adapter.findUserByEmail(email))?.user;
	if (user && !user.emailVerified) {
		await resetUnverifiedAccount(user.id);
		user = await adapter.updateUser(user.id, { emailVerified: true });
	}
	if (user) return user;
	try {
		return await adapter.createUser(
			{ email, name, emailVerified: true },
			{ method },
		);
	} catch (error) {
		// A concurrent confirm (double tap, two tabs) created the user first.
		const existing = (await adapter.findUserByEmail(email))?.user;
		if (!existing) throw error;
		return existing;
	}
}
