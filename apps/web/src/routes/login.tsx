import { loginFn, type LoginInput, type LoginResult } from '@repo/api/handlers/login';
import { Login } from '@repo/ui/composed/login';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

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

	const error = loginMutation.isError
		? { message: loginMutation.error?.message ?? 'Something went wrong' }
		: loginMutation.data?.error
			? loginMutation.data
			: null;

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Login
				onLogin={(data) => loginMutation.mutate({ data })}
				error={error}
				success={loginMutation.isSuccess && !loginMutation.data?.error}
				isLoading={loginMutation.isPending}
			/>
		</div>
	);
}
