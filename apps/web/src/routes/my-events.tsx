import { myCalendarUrlQueryOptions } from "@repo/api/calendar/my-calendar-url";
import { myRegistrationListQueryOptions } from "@repo/api/events/my-registration-list";
import { ensureMyRegistrations } from "@repo/api/events/my-registrations";
import { myGroupsQueryOptions } from "@repo/api/groups/queries";
import {
	my_events_browse,
	my_events_description,
	my_events_title,
} from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { Button } from "@repo/ui/components/button";
import { PageHeader } from "@repo/ui/composed/page-header";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MyCalendar } from "~/components/account/my-calendar";
import { MyGroups } from "~/components/account/my-groups";
import { MyRegistrations } from "~/components/account/my-registrations";

export const Route = createFileRoute("/my-events")({
	beforeLoad: ({ context }) => {
		requireAuthenticatedUser(context, { loginRedirect: "/my-events" });
	},
	loader: ({ context: { queryClient } }) =>
		Promise.all([
			queryClient.ensureQueryData(myRegistrationListQueryOptions),
			ensureMyRegistrations(queryClient),
			queryClient.ensureQueryData(myCalendarUrlQueryOptions),
			queryClient.ensureQueryData(myGroupsQueryOptions),
		]),
	head: () => studentsPageHead(my_events_title()),
	component: MyEventsPage,
});

/** Where a signed-in person lands: what they signed up for, tickets at hand. */
function MyEventsPage() {
	const { user } = Route.useRouteContext();
	if (!user) {
		return null;
	}
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<PageHeader
					title={my_events_title()}
					description={my_events_description()}
					className="flex-1"
				/>
				<Button asChild variant="outline">
					<Link to="/">{my_events_browse()}</Link>
				</Button>
			</div>
			<MyRegistrations userId={user.id} />
			<MyGroups />
			<MyCalendar />
		</div>
	);
}
