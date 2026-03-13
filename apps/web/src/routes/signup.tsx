import { findUserByEmail, createUser } from '@repo/db/queries/users';
import { hashPassword } from '@repo/api/auth/hash';
import { useAppSession } from '@repo/api/auth/session';
import { Auth } from '@repo/ui/composed/auth';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn, useServerFn } from '@tanstack/react-start';

export const signupFn = createServerFn({ method: 'POST' })
	.inputValidator((d: { email: string; password: string; redirectUrl?: string }) => d)
	.handler(async ({ data }) => {
		const found = await findUserByEmail(data.email);
		const hashedPassword = await hashPassword(data.password);
		const session = await useAppSession();

		if (found) {
			if (found.password !== hashedPassword) {
				return {
					error: true,
					userExists: true,
					message: 'User already exists',
				};
			}
			await session.update({ userEmail: found.email });
			throw redirect({ to: data.redirectUrl || '/' });
		}

		const user = await createUser(data.email, hashedPassword);
		await session.update({ userEmail: user.email });
		throw redirect({ to: data.redirectUrl || '/' });
	});

export const Route = createFileRoute('/signup')({
	component: SignupComp,
});

function SignupComp() {
	const signup = useServerFn(signupFn);
	const signupMutation = useMutation({
		mutationFn: (vars: Parameters<typeof signup>[0]) => signup(vars),
	});

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Auth
				title="Sign up"
				submitLabel="Sign up"
				isLoading={signupMutation.isPending}
				loadingLabel="Signing up..."
				onSubmit={(e) => {
					e.preventDefault();
					const form = e.target as HTMLFormElement;
					const formData = new FormData(form);
					signupMutation.mutate({
						data: {
							email: formData.get('email') as string,
							password: formData.get('password') as string,
						},
					});
				}}
				afterSubmit={
					signupMutation.data?.error ? (
						<span>{signupMutation.data.message}</span>
					) : null
				}
			>
				<div>
					<label htmlFor="email" className="block text-sm font-medium">
						Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						required
						disabled={signupMutation.isPending}
						className="mt-1 w-full rounded-md border px-3 py-2"
					/>
				</div>
				<div>
					<label htmlFor="password" className="block text-sm font-medium">
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						disabled={signupMutation.isPending}
						className="mt-1 w-full rounded-md border px-3 py-2"
					/>
				</div>
			</Auth>
		</div>
	);
}
