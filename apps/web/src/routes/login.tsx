import { type LoginInput, type LoginResult, loginFn } from '@repo/api/handlers/login';
import { Auth } from '@repo/ui/composed/auth';
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { getErrorMessage } from '../utils/validation-error';

export const Route = createFileRoute('/login')({
	component: LoginComp,
});

function LoginComp() {
	const router = useRouter();
	const login = useServerFn(loginFn);
	const loginMutation = useMutation<LoginResult, Error, LoginInput>({
		mutationFn: (vars) => login(vars),
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
			loginMutation.mutate({
				data: {
					email: value.email,
					password: value.password,
				},
			});
		},
	});

	const error = loginMutation.isError
		? { message: getErrorMessage(loginMutation.error) }
		: loginMutation.data?.error
			? loginMutation.data
			: null;

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Auth
				title="Log in"
				submitLabel="Log in"
				isLoading={loginMutation.isPending}
				loadingLabel="Logging in..."
				onSubmit={(e) => {
					e.preventDefault();
					form.handleSubmit();
				}}
				afterSubmit={
					error ? (
						<span role="alert">{error.message}</span>
					) : loginMutation.isSuccess && !loginMutation.data?.error ? (
						<span className="text-green-600 dark:text-green-400" role="status">
							Logged in! Redirecting...
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
								disabled={loginMutation.isPending}
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
								disabled={loginMutation.isPending}
								className="mt-1 w-full rounded-md border px-3 py-2"
							/>
						</div>
					)}
				</form.Field>
			</Auth>
		</div>
	);
}
