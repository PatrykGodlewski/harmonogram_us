import { signupFn, type SignupInput, type SignupResult } from '@repo/api/handlers/signup';
import { Signup } from '@repo/ui/composed/signup';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';

export const Route = createFileRoute('/signup')({
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: '/' });
		}
	},
	component: SignupComp,
});

function SignupComp() {
	const router = useRouter();
	const signup = useServerFn(signupFn);
	const signupMutation = useMutation<SignupResult, Error, SignupInput>({
		mutationFn: signup,
		onSuccess: (data) => {
			if (!data?.error) {
				router.navigate({ to: '/' });
			}
		},
	});

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Signup
				onSignup={(data) => signupMutation.mutate({ data })}
				status={{
					isRequestError: signupMutation.isError,
					requestErrorMessage: signupMutation.error?.message,
					serverError: signupMutation.data?.error ? signupMutation.data : null,
					isLoading: signupMutation.isPending,
				}}
			/>
		</div>
	);
}
