import { findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { useAppSession } from '../auth/session';
import type { AuthCredentials } from '../auth/schemas';
import { loginInputSchema } from '../auth/schemas';
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
	.inputValidator((input) => loginInputSchema.parse(input))
	.handler(async (ctx) => {
		const { email, password } = (ctx as unknown as { data: AuthCredentials }).data;
		const user = await findUserByEmail(email);
		if (!user?.password) return loginErrors.userNotFound;

		const isValid = await verifyPasswordHash(user.password, password);
		if (!isValid) return loginErrors.invalidPassword;

		const session = await useAppSession();
		await session.update({
			userId: user.id,
			email: user.email,
		});
	});

export type LoginInput = Parameters<typeof loginFn>[0];
export type LoginResult = Awaited<ReturnType<typeof loginFn>>;
