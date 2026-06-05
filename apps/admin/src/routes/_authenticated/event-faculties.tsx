import {
	createAdminEventFacultyServer,
	deleteAdminEventFacultyServer,
	updateAdminEventFacultyServer,
} from "@repo/api/admin/mutations";
import {
	adminEventFacultiesQueryOptions,
	fetchAdminEventFacultiesServer,
} from "@repo/api/admin/queries";
import {
	admin_event_faculties_description,
	admin_event_faculties_title,
	admin_nav_event_faculties,
} from "@repo/i18n/paraglide/messages";
import { createFileRoute } from "@tanstack/react-router";
import { AdminLookupPage } from "~/components/admin-lookup-page";

export const Route = createFileRoute("/_authenticated/event-faculties")({
	component: AdminEventFacultiesPage,
});

function AdminEventFacultiesPage() {
	return (
		<AdminLookupPage
			entityName={admin_nav_event_faculties()}
			title={admin_event_faculties_title()}
			description={admin_event_faculties_description()}
			queryKey={adminEventFacultiesQueryOptions.queryKey}
			queryFn={() => fetchAdminEventFacultiesServer()}
			createFn={createAdminEventFacultyServer}
			updateFn={updateAdminEventFacultyServer}
			deleteFn={deleteAdminEventFacultyServer}
		/>
	);
}
