import { type SignupInput, type SignupResult, signupFn } from '@repo/api/handlers/signup';
import { Auth } from '@repo/ui/composed/auth';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { getErrorMessage } from '../utils/validation-error';

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

	const form = useForm({
		defaultValues: {
			email: '',
			password: '',
		},
		onSubmit: ({ value }) => {
			signupMutation.mutate({
				data: {
					email: value.email,
					password: value.password,
				},
			});
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
					form.handleSubmit();
				}}
				afterSubmit={
					signupMutation.isError ? (
						<span role="alert">{getErrorMessage(signupMutation.error)}</span>
					) : signupMutation.data?.error ? (
						<span role="alert">{signupMutation.data.message}</span>
					) : signupMutation.isSuccess && !signupMutation.data?.error ? (
						<span className="text-green-600 dark:text-green-400" role="status">
							Account created! Redirecting...
						</span>
					) : null
				}
			>
				<form.Field name="email">
					{(field) => (
						<div>
							<label htmlFor={field.name} className="block text-sm font-medium">
								Email
							</label>
							<input
								id={field.name}
								name={field.name}
								type="email"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								disabled={signupMutation.isPending}
								className="mt-1 w-full rounded-md border px-3 py-2"
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="password">
					{(field) => (
						<div>
							<label htmlFor={field.name} className="block text-sm font-medium">
								Password
							</label>
							<input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								disabled={signupMutation.isPending}
								className="mt-1 w-full rounded-md border px-3 py-2"
							/>
						</div>
					)}
				</form.Field>
			</Auth>
		</div>
	);
}
