import { findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { useAppSession } from '../auth/session';
import { verifyPasswordHash } from '../auth/hash';

const loginErrors = {
	userNotFound: {
		error: true as const,
		userNotFound: true,
		message: 'User not found',
	},
	invalidPassword: { error: true as const, message: 'Incorrect password' },
};

export const loginFn = createServerFn({ method: 'POST' })
	.inputValidator((d: { email: string; password: string }) => d)
	.handler(async ({ data }) => {
		const user = await findUserByEmail(data.email);
		if (!user?.password) return loginErrors.userNotFound;

		const isValid = await verifyPasswordHash(user.password, data.password);
		if (!isValid) return loginErrors.invalidPassword;

		const session = await useAppSession();
		await session.update({
			userId: user.id,
			email: user.email,
		});
	});
