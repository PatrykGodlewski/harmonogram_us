import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { Login } from "@repo/ui/composed/login";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		redirect: z.string().optional(),
	}),
	beforeLoad: ({ context }) => {
		if (context.user) {
			throw redirect({ to: "/" });
		}
	},
	component: LoginComp,
});

function LoginComp() {
	const { redirect } = Route.useSearch();
	const redirectTo = redirect?.startsWith("/")
		? localizeHref(redirect)
		: localizeHref("/");

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<Login redirectTo={redirectTo} />
		</div>
	);
}
