import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { AdminLayout } from "@repo/ui/composed/admin/admin-layout";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context, location }) => {
		requireAuthenticatedUser(context, { loginRedirect: location.href });
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	return (
		<AdminLayout>
			<Outlet />
		</AdminLayout>
	);
}
