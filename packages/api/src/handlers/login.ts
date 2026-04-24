import { findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { useAppSession } from '../auth/session';
import { loginInputSchema } from '../auth/schemas';
import { verifyPasswordHash } from '../auth/hash';

const loginErrors = {
	invalidCredentials: {
		error: true as const,
		message: 'Invalid email or password',
	},
};

export const loginFn = createServerFn({ method: 'POST' })
	.inputValidator((input) => loginInputSchema.parse(input))
	.handler(async ({ data }) => {
		const { email, password } = data;
		const user = await findUserByEmail(email);
		if (!user?.password) return loginErrors.invalidCredentials;

		const isValid = await verifyPasswordHash(user.password, password);
		if (!isValid) return loginErrors.invalidCredentials;

		const session = await useAppSession();
		await session.update({
			userId: user.id,
			email: user.email,
		});
	});

export type LoginInput = Parameters<typeof loginFn>[0];
export type LoginResult = Awaited<ReturnType<typeof loginFn>>;
