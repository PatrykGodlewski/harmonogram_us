import {
	createAdminEventLocationServer,
	deleteAdminEventLocationServer,
	updateAdminEventLocationServer,
} from "@repo/api/admin/mutations";
import {
	adminEventLocationsQueryOptions,
	fetchAdminEventLocationsServer,
} from "@repo/api/admin/queries";
import {
	admin_event_locations_description,
	admin_event_locations_title,
	admin_nav_event_locations,
} from "@repo/i18n/paraglide/messages";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLookupPage } from "~/components/admin-lookup-page";

export const Route = createFileRoute("/_authenticated/event-locations")({
	component: AdminEventLocationsPage,
});

function AdminEventLocationsPage() {
	return (
		<AdminLookupPage
			entityName={admin_nav_event_locations()}
			title={admin_event_locations_title()}
			description={admin_event_locations_description()}
			queryKey={adminEventLocationsQueryOptions.queryKey}
			queryFn={() => fetchAdminEventLocationsServer()}
			createFn={createAdminEventLocationServer}
			updateFn={updateAdminEventLocationServer}
			deleteFn={deleteAdminEventLocationServer}
		/>
	);
}
