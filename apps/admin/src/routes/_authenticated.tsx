import {
	admin_no_access_body,
	admin_no_access_title,
	header_logout,
} from "@repo/i18n/paraglide/messages";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { Button } from "@repo/ui/components/button";
import { AdminLayout } from "@repo/ui/composed/admin/admin-layout";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: ({ context, location }) => {
		requireAuthenticatedUser(context, { loginRedirect: location.href });
	},
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { user } = Route.useRouteContext();

	// Server functions check access too; this only avoids showing a broken panel.
	if (!user?.hasPanelAccess) {
		return <NoAccess />;
	}

	return (
		<AdminLayout isAdmin={user.isAdmin}>
			<Outlet />
		</AdminLayout>
	);
}

function NoAccess() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
			<h1 className="text-xl font-semibold">{admin_no_access_title()}</h1>
			<p className="max-w-sm text-muted-foreground">{admin_no_access_body()}</p>
			<Button variant="outline" asChild>
				<Link to="/logout">{header_logout()}</Link>
			</Button>
		</div>
	);
}
