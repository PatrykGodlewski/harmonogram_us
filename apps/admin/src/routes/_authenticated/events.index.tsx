import {
	adminEventFilterOptionsQueryOptions,
	adminEventsQueryOptions,
} from "@repo/api/admin/queries";
import { admin_events_title } from "@repo/i18n/paraglide/messages";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { AdminEventsPage } from "~/components/admin-events-page";

export const Route = createFileRoute("/_authenticated/events/")({
	// Fetched on the server with the page, so a refresh shows the list at once.
	loader: ({ context: { queryClient } }) =>
		Promise.all([
			queryClient.ensureQueryData(adminEventsQueryOptions()),
			queryClient.ensureQueryData(adminEventFilterOptionsQueryOptions),
		]),
	head: () => adminPageHead(admin_events_title()),
	component: AdminEventsRoute,
});

function AdminEventsRoute() {
	const { user } = Route.useRouteContext();
	return <AdminEventsPage canCreateEvents={user?.role !== "user"} />;
}
