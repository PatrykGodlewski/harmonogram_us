import { findUserByEmail, createUser } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { useAppSession } from '../auth/session';
import type { AuthCredentials } from '../auth/schemas';
import { signupInputSchema } from '../auth/schemas';
import { hashPassword, verifyPasswordHash } from '../auth/hash';

const signupErrors = {
	userExists: {
		error: true as const,
		userExists: true,
		message: 'User already exists',
	},
};

export const signupFn = createServerFn({ method: 'POST' })
	.inputValidator((input) => signupInputSchema.parse(input))
	.handler(async (ctx) => {
		const { email, password } = (ctx as unknown as { data: AuthCredentials }).data;
		const found = await findUserByEmail(email);
		const hashedPassword = await hashPassword(password);

		if (found) {
			if (!found.password || !(await verifyPasswordHash(found.password, password))) {
				return signupErrors.userExists;
			}
			const session = await useAppSession();
			await session.update({ userId: found.id, email: found.email });
			return;
		}

		const user = await createUser(email, hashedPassword);
		const session = await useAppSession();
		await session.update({ userId: user.id, email: user.email });
	});

export type SignupInput = Parameters<typeof signupFn>[0];
export type SignupResult = Awaited<ReturnType<typeof signupFn>>;
