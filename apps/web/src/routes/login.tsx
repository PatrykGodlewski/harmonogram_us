import { loginFn } from '@repo/api/handlers/login';
import { Login } from '@repo/ui/composed/login';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/login')({
	component: LoginComp,
});

function LoginComp() {
	const router = useRouter();
	const login = useServerFn(loginFn);
	const loginMutation = useMutation({
		mutationFn: (vars: Parameters<typeof login>[0]) => login(vars),
		onSuccess: (data: { error?: boolean; message?: string } | void) => {
			if (!data?.error) router.navigate({ to: '/' });
		},
	});

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Login
				onLogin={(data) => loginMutation.mutate({ data })}
				error={loginMutation.data?.error ? loginMutation.data : null}
				isLoading={loginMutation.isPending}
			/>
		</div>
	);
}
