import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { AdminLogin } from "@repo/ui/composed/admin-login";
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
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const { redirect } = Route.useSearch();
	const redirectTo = redirect?.startsWith("/")
		? localizeHref(redirect)
		: localizeHref("/");

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<AdminLogin redirectTo={redirectTo} />
		</div>
	);
}
