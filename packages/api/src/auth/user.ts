import { findUserById } from '@repo/db/queries/users';
import { useAppSession } from './session';

export type AuthenticatedUser = {
	id: number;
	email: string;
};

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
	const session = await useAppSession();
	const { userId, email } = session.data;
	if (!userId || !email) return null;

	const user = await findUserById(userId);
	if (!user || user.email !== email) {
		await session.clear();
		return null;
	}

	return { id: user.id, email: user.email };
}
