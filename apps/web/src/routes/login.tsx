import { universitySignInQueryOptions } from "@repo/api/auth/sign-in-options";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { Login } from "@repo/ui/composed/login";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		redirect: z.string().optional(),
		/** Set when a university sign-in or an e-mail link comes back failed. */
		error: z.string().optional(),
	}),
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(universitySignInQueryOptions),
	component: LoginComp,
});

function LoginComp() {
	const { redirect, error } = Route.useSearch();
	const { data: university } = useSuspenseQuery(universitySignInQueryOptions);
	// Same-site paths only: "//host" would be another site.
	const redirectTo =
		redirect?.startsWith("/") && !redirect.startsWith("//")
			? localizeHref(redirect)
			: localizeHref("/");

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Login
				redirectTo={redirectTo}
				university={university}
				failed={Boolean(error)}
			/>
		</div>
	);
}
