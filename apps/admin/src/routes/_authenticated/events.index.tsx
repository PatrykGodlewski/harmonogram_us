import { createFileRoute } from "@tanstack/react-router";
import { AdminEventsPage } from "~/components/admin-events-page";

export const Route = createFileRoute("/_authenticated/events/")({
	component: AdminEventsRoute,
});

function AdminEventsRoute() {
	const { user } = Route.useRouteContext();
	return <AdminEventsPage canCreateEvents={user?.role !== "user"} />;
}
