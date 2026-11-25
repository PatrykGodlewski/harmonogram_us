import { universitySignInQueryOptions } from "@repo/api/auth/sign-in-options";
import { auth_title_signup } from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { Signup } from "@repo/ui/composed/signup";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/signup")({
	validateSearch: z.object({
		/** Where to go after signing up (e.g. back to an event to register). */
		redirect: z.string().optional(),
	}),
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(universitySignInQueryOptions),
	head: () => studentsPageHead(auth_title_signup()),
	component: SignupComp,
});

function SignupComp() {
	const { data: university } = useSuspenseQuery(universitySignInQueryOptions);
	const { redirect: target } = Route.useSearch();
	// Same-site paths only: "//host" would be another site.
	const redirectTo =
		target?.startsWith("/") && !target.startsWith("//") ? target : undefined;
	return (
		<div className="flex min-h-[50vh] items-center justify-center p-4 sm:p-8">
			<Signup university={university} redirectTo={redirectTo} />
		</div>
	);
}
