import { adminActivityQueryOptions } from "@repo/api/admin/activity";
import {
	admin_home_description,
	admin_home_title,
} from "@repo/i18n/paraglide/messages";
import { PageHeader } from "@repo/ui/composed/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { AdminActivity } from "~/components/admin-activity";

export const Route = createFileRoute("/_authenticated/")({
	loader: async ({ context: { queryClient, user } }) => {
		// Platform-wide numbers are for administrators only (the server checks too).
		if (user?.isAdmin) {
			await queryClient.ensureQueryData(adminActivityQueryOptions);
		}
	},
	component: AdminHomePage,
});

function AdminHomePage() {
	const { user } = Route.useRouteContext();
	return (
		<div className="flex flex-col gap-8">
			<PageHeader
				title={admin_home_title()}
				description={admin_home_description()}
			/>
			{user?.isAdmin ? <AdminActivity /> : null}
		</div>
	);
}
