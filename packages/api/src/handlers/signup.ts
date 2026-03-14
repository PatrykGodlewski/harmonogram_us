import { createUser, findUserByEmail } from '@repo/db/queries/users';
import { createServerFn } from '@tanstack/react-start';
import { hashPassword, verifyPasswordHash } from '../auth/hash';
import { signupInputSchema } from '../auth/schemas';
import { useAppSession } from '../auth/session';

interface SignupError {
	readonly error: true;
	readonly userExists: true;
	readonly message: string;
}

const USER_EXISTS_ERROR: SignupError = {
	error: true,
	userExists: true,
	message: 'User already exists',
};

function requireNonEmptyPassword(password: string): asserts password is string {
	if (typeof password !== 'string' || !password.trim()) {
		throw new Error('Password is required');
	}
}

export const signupFn = createServerFn({ method: 'POST' })
	.inputValidator((input) => signupInputSchema.parse(input))
	.handler(async (input) => {
		const { email, password } = input.data.data;
		requireNonEmptyPassword(password);

		const found = await findUserByEmail(email);
		const hashedPassword = await hashPassword(password);

		if (found) {
			const isValid = found.password && (await verifyPasswordHash(found.password, password));
			if (!isValid) return USER_EXISTS_ERROR;

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
