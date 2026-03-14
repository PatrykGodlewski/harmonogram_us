import { findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { verifyPasswordHash } from '../auth/hash';
import { loginInputSchema } from '../auth/schemas';
import { useAppSession } from '../auth/session';

interface LoginError {
	readonly error: true;
	readonly message: string;
}

interface UserNotFoundError extends LoginError {
	readonly userNotFound: true;
}

const USER_NOT_FOUND: UserNotFoundError = {
	error: true,
	userNotFound: true,
	message: 'User not found',
};

const INVALID_PASSWORD: LoginError = {
	error: true,
	message: 'Incorrect password',
};

export const loginFn = createServerFn({ method: 'POST' })
	.inputValidator((input) => loginInputSchema.parse(input))
	.handler(async (input) => {
		const { email, password } = input.data.data;

		const user = await findUserByEmail(email);
		if (!user?.password) return USER_NOT_FOUND;

		const isValid = await verifyPasswordHash(user.password, password);
		if (!isValid) return INVALID_PASSWORD;

		const session = await useAppSession();
		await session.update({
			userId: user.id,
			email: user.email,
		});
	});

export type LoginInput = Parameters<typeof loginFn>[0];
export type LoginResult = Awaited<ReturnType<typeof loginFn>>;
