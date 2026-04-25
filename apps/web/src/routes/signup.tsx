import { Signup } from "@repo/ui/composed/signup";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	component: SignupComp,
});

function SignupComp() {
	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Signup />
		</div>
	);
}
