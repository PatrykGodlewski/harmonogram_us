import { createUser, findUserByEmail } from "@repo/db/queries/users";
import { createServerFn } from "@tanstack/react-start";
import { hashPassword, verifyPasswordStrength } from "../auth/hash";
import { signupInputSchema } from "../auth/schemas";
import { useAppSession } from "../auth/session";

const signupErrors = {
	userExists: {
		error: true as const,
		userExists: true,
		message: "User already exists",
	},
	passwordsDoNotMatch: {
		error: true as const,
		message: "Passwords do not match",
	},
	invalidPassword: {
		error: true as const,
		message: "Password does not meet security requirements",
	},
};

export const signupFn = createServerFn({ method: "POST" })
	.inputValidator((input) => signupInputSchema.parse(input))
	.handler(async ({ data }) => {
		const { email, password, confirmPassword } = data;
		if (password !== confirmPassword) {
			return signupErrors.passwordsDoNotMatch;
		}
		if (!(await verifyPasswordStrength(password))) {
			return signupErrors.invalidPassword;
		}

		const found = await findUserByEmail(email);
		if (found) return signupErrors.userExists;

		const hashedPassword = await hashPassword(password);
		const user = await createUser(email, hashedPassword);
		const session = await useAppSession();
		await session.update({ userId: user.id, email: user.email });
	});

export type SignupInput = Parameters<typeof signupFn>[0];
export type SignupResult = Awaited<ReturnType<typeof signupFn>>;
