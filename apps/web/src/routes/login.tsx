import { loginFn, type LoginInput, type LoginResult } from '@repo/api/handlers/login';
import { Login } from '@repo/ui/composed/login';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/login')({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
	}),
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: '/' });
		}
	},
	component: LoginComp,
});

function LoginComp() {
	const router = useRouter();
	const { redirect } = Route.useSearch();
	const redirectTo = redirect?.startsWith('/') ? redirect : '/';
	const login = useServerFn(loginFn);
	const loginMutation = useMutation<LoginResult, Error, LoginInput>({
		mutationFn: login,
		onSuccess: (data) => {
			if (!data?.error) {
				router.navigate({ to: redirectTo });
			}
		},
	});

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Login
				onLogin={(data) => loginMutation.mutate({ data })}
				status={{
					isRequestError: loginMutation.isError,
					requestErrorMessage: loginMutation.error?.message,
					serverError: loginMutation.data?.error ? loginMutation.data : null,
					success: loginMutation.isSuccess && !loginMutation.data?.error,
					isLoading: loginMutation.isPending,
				}}
			/>
		</div>
	);
}
