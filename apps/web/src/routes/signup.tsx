import { signupFn, type SignupInput, type SignupResult } from '@repo/api/handlers/signup';
import { Auth } from '@repo/ui/composed/auth';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/signup')({
	component: SignupComp,
});

function SignupComp() {
	const router = useRouter();
	const signup = useServerFn(signupFn);
	const signupMutation = useMutation<SignupResult, Error, SignupInput>({
		mutationFn: (vars) => signup(vars),
		onSuccess: (data) => {
			if (!data?.error) {
				setTimeout(() => router.navigate({ to: '/' }), 1500);
			}
		},
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
					signupMutation.isError ? (
						<span role="alert">{signupMutation.error?.message ?? 'Something went wrong'}</span>
					) : signupMutation.data?.error ? (
						<span role="alert">{signupMutation.data.message}</span>
					) : signupMutation.isSuccess && !signupMutation.data?.error ? (
						<span className="text-green-600 dark:text-green-400" role="status">
							Account created! Redirecting...
						</span>
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
