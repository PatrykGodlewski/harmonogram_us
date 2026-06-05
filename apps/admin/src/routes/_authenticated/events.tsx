import { createFileRoute } from "@tanstack/react-router";
import { AdminEventsPage } from "~/components/admin-events-page";

export const Route = createFileRoute("/_authenticated/events")({
	component: AdminEventsPage,
});
