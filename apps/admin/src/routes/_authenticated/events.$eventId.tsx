import { eventOrganizersQueryOptions } from "@repo/api/admin/organizers";
import {
	adminEventDetailsQueryOptions,
	adminEventFilterOptionsQueryOptions,
	adminEventGroupsQueryOptions,
	adminEventRegistrantsQueryOptions,
} from "@repo/api/admin/queries";
import { eventQuestionsQueryOptions } from "@repo/api/admin/questions";
import {
	admin_error_generic,
	admin_event_forbidden,
	admin_events_title,
} from "@repo/i18n/paraglide/messages";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { getAppErrorCode } from "@repo/ui/app-errors";
import { noShowsCounted } from "@repo/ui/registrant-stats";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AgendaEditor } from "~/components/admin-event-detail/agenda-editor";
import { EventStatsCard } from "~/components/admin-event-detail/event-stats-card";
import { EventSummaryCard } from "~/components/admin-event-detail/event-summary-card";
import { GroupsList } from "~/components/admin-event-detail/groups-list";
import { OrganizersCard } from "~/components/admin-event-detail/organizers-card";
import { QuestionsCard } from "~/components/admin-event-detail/questions-card";
import { RegistrantsList } from "~/components/admin-event-detail/registrants-list";
import { formatMutationError } from "~/lib/format-mutation-error";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
	validateSearch: z.object({
		agenda: z.enum(["list", "calendar"]).optional().catch(undefined),
	}),
	// Fetched on the server with the page. A failure (e.g. no access) is left to
	// the page, which shows it in place of the event.
	loader: ({ context: { queryClient }, params: { eventId } }) => {
		const settle = <T,>(load: Promise<T>) => load.catch(() => undefined);
		return Promise.all([
			settle(
				queryClient.ensureQueryData(adminEventDetailsQueryOptions(eventId)),
			),
			settle(
				queryClient.ensureQueryData(adminEventRegistrantsQueryOptions(eventId)),
			),
			settle(
				queryClient.ensureQueryData(
					eventQuestionsQueryOptions(eventId, "registration"),
				),
			),
			settle(
				queryClient.ensureQueryData(adminEventGroupsQueryOptions(eventId)),
			),
			settle(queryClient.ensureQueryData(eventOrganizersQueryOptions(eventId))),
			settle(queryClient.ensureQueryData(adminEventFilterOptionsQueryOptions)),
		]);
	},
	head: ({ loaderData }) =>
		adminPageHead(loaderData?.[0]?.title ?? admin_events_title()),
	component: AdminEventDetailPage,
});

function AdminEventDetailPage() {
	const { eventId } = Route.useParams();
	const view = Route.useSearch().agenda ?? "list";
	const navigate = Route.useNavigate();
	const handleViewChange = (next: "list" | "calendar") =>
		void navigate({
			search: (prev) => ({
				...prev,
				agenda: next === "list" ? undefined : next,
			}),
			replace: true,
			resetScroll: false,
		});
	const queryClient = useQueryClient();
	const { data: event, error } = useQuery(
		adminEventDetailsQueryOptions(eventId),
	);
	const { data: registrants = [] } = useQuery(
		adminEventRegistrantsQueryOptions(eventId),
	);
	const { data: filterOptions } = useQuery(adminEventFilterOptionsQueryOptions);
	const { data: groups = [] } = useQuery(adminEventGroupsQueryOptions(eventId));

	const handleChanged = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["admin", "event", eventId] }),
			queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
		]);

	if (error && getAppErrorCode(error) === "FORBIDDEN") {
		return (
			<p className="p-4 text-muted-foreground">{admin_event_forbidden()}</p>
		);
	}
	if (error) {
		return (
			<p className="p-4 text-muted-foreground">
				{formatMutationError(error, admin_error_generic)}
			</p>
		);
	}
	if (!event) {
		return null;
	}

	const canManage = event.access === "manage";
	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div className="flex flex-col gap-8">
				<EventSummaryCard event={event} onChanged={handleChanged} />
				<EventStatsCard
					registrants={registrants}
					ended={noShowsCounted(event)}
				/>
				{canManage ? (
					<AgendaEditor
						eventId={event.id}
						eventDate={new Date(event.date)}
						agenda={event.agenda}
						locations={filterOptions?.locations ?? []}
						onChanged={handleChanged}
						view={view}
						onViewChange={handleViewChange}
					/>
				) : null}
			</div>
			<div className="flex flex-col gap-8">
				{canManage ? <OrganizersCard eventId={event.id} /> : null}
				{canManage ? <QuestionsCard eventId={event.id} /> : null}
				{canManage ? <GroupsList groups={groups} /> : null}
				<RegistrantsList
					mode={canManage ? "manage" : "checkin"}
					eventId={event.id}
					eventTitle={event.title}
					registrants={registrants}
					agenda={event.agenda}
					onChanged={handleChanged}
				/>
			</div>
		</div>
	);
}
