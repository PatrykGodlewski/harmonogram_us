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
	admin_event_agenda,
	admin_event_forbidden,
	admin_events_title,
	admin_organizers_title,
	admin_section_overview,
	admin_section_registrants,
	materials_title,
	questions_title,
	stats_title,
} from "@repo/i18n/paraglide/messages";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { getAppErrorCode } from "@repo/ui/app-errors";
import { noShowsCounted } from "@repo/ui/registrant-stats";
import { cn } from "@repo/ui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AgendaEditor } from "~/components/admin-event-detail/agenda-editor";
import { EventStatsCard } from "~/components/admin-event-detail/event-stats-card";
import { EventSummaryCard } from "~/components/admin-event-detail/event-summary-card";
import { GroupsList } from "~/components/admin-event-detail/groups-list";
import { MaterialsCard } from "~/components/admin-event-detail/materials-card";
import { OrganizersCard } from "~/components/admin-event-detail/organizers-card";
import { QuestionsCard } from "~/components/admin-event-detail/questions-card";
import { RegistrantsList } from "~/components/admin-event-detail/registrants-list";
import {
	type PageSection,
	SectionNav,
} from "~/components/admin-event-detail/section-nav";
import { SurveySummaryCard } from "~/components/admin-event-detail/survey-summary-card";
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
	const sections: PageSection[] = [
		{ id: "przeglad", label: admin_section_overview() },
		{ id: "statystyki", label: stats_title() },
		{ id: "zapisani", label: admin_section_registrants() },
		...(canManage
			? [
					{ id: "program", label: admin_event_agenda() },
					{ id: "materialy", label: materials_title() },
					{ id: "pytania", label: questions_title() },
					{ id: "organizatorzy", label: admin_organizers_title() },
				]
			: []),
	];
	// On a phone the sections stack in order of use (registrants early); from lg up two columns.
	const section = "scroll-mt-16";
	return (
		<div className="flex flex-col gap-6">
			<SectionNav sections={sections} />
			<div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="contents lg:flex lg:flex-col lg:gap-8">
					<div id="przeglad" className={cn(section, "order-1 lg:order-none")}>
						<EventSummaryCard event={event} onChanged={handleChanged} />
					</div>
					<div id="statystyki" className={cn(section, "order-2 lg:order-none")}>
						<EventStatsCard
							registrants={registrants}
							ended={noShowsCounted(event)}
						/>
					</div>
					{canManage ? (
						<div id="program" className={cn(section, "order-4 lg:order-none")}>
							<AgendaEditor
								eventId={event.id}
								eventDate={new Date(event.date)}
								agenda={event.agenda}
								sessions={event.sessions}
								options={filterOptions}
								onChanged={handleChanged}
								view={view}
								onViewChange={handleViewChange}
							/>
						</div>
					) : null}
					{canManage ? (
						<div
							id="materialy"
							className={cn(section, "order-5 lg:order-none")}
						>
							<MaterialsCard
								eventId={event.id}
								agenda={event.agenda}
								materials={event.materials}
								files={event.files}
								onChanged={handleChanged}
							/>
						</div>
					) : null}
				</div>
				<div className="contents lg:flex lg:flex-col lg:gap-8">
					<div
						id="zapisani"
						className={cn(section, "order-3 flex flex-col gap-8 lg:order-last")}
					>
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
					{canManage ? (
						<div
							id="pytania"
							className={cn(
								section,
								"order-6 flex flex-col gap-8 lg:order-none",
							)}
						>
							<QuestionsCard eventId={event.id} form="registration" />
							<QuestionsCard eventId={event.id} form="survey" />
							<SurveySummaryCard eventId={event.id} />
						</div>
					) : null}
					{canManage ? (
						<div
							id="organizatorzy"
							className={cn(section, "order-7 lg:order-first")}
						>
							<OrganizersCard eventId={event.id} />
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}
