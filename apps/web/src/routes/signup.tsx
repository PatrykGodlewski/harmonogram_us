import { universitySignInQueryOptions } from "@repo/api/auth/sign-in-options";
import { Signup } from "@repo/ui/composed/signup";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(universitySignInQueryOptions),
	component: SignupComp,
});

function SignupComp() {
	const { data: university } = useSuspenseQuery(universitySignInQueryOptions);
	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Signup university={university} />
		</div>
	);
}
