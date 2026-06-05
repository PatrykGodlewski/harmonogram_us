import {
	createAdminEventTypeServer,
	deleteAdminEventTypeServer,
	updateAdminEventTypeServer,
} from "@repo/api/admin/mutations";
import {
	adminEventTypesQueryOptions,
	fetchAdminEventTypesServer,
} from "@repo/api/admin/queries";
import {
	admin_event_types_description,
	admin_event_types_title,
	admin_nav_event_types,
} from "@repo/i18n/paraglide/messages";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLookupPage } from "~/components/admin-lookup-page";

export const Route = createFileRoute("/_authenticated/event-types")({
	component: AdminEventTypesPage,
});

function AdminEventTypesPage() {
	return (
		<AdminLookupPage
			entityName={admin_nav_event_types()}
			title={admin_event_types_title()}
			description={admin_event_types_description()}
			queryKey={adminEventTypesQueryOptions.queryKey}
			queryFn={() => fetchAdminEventTypesServer()}
			createFn={createAdminEventTypeServer}
			updateFn={updateAdminEventTypeServer}
			deleteFn={deleteAdminEventTypeServer}
		/>
	);
}
