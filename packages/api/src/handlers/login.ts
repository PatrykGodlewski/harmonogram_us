import { findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { hashPassword } from '../auth/hash';
import { useAppSession } from '../auth/session';

export const loginFn = createServerFn({ method: 'POST' })
	.inputValidator((d: { email: string; password: string }) => d)
	.handler(async ({ data }) => {
		const user = await findUserByEmail(data.email);
		if (!user) {
			return { error: true, userNotFound: true, message: 'User not found' };
		}
		const hashedPassword = await hashPassword(data.password);
		if (user.password !== hashedPassword) {
			return { error: true, message: 'Incorrect password' };
		}
		const session = await useAppSession();
		await session.update({ userEmail: user.email });
	});
