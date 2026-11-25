import {
	adminEventDetailsQueryOptions,
	adminEventFilterOptionsQueryOptions,
} from "@repo/api/admin/queries";
import {
	admin_error_generic,
	admin_event_forbidden,
	admin_events_title,
	admin_session_back,
	error_session_not_found,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { getAppErrorCode } from "@repo/ui/app-errors";
import { sessionColorClasses } from "@repo/ui/session-colors";
import { formatEventDateTime, formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AgendaEditor } from "~/components/admin-event-detail/agenda-editor";
import { formatMutationError } from "~/lib/format-mutation-error";

export const Route = createFileRoute(
	"/_authenticated/events/$eventId_/sessions/$sessionId",
)({
	validateSearch: z.object({
		agenda: z.enum(["list", "calendar"]).optional().catch(undefined),
	}),
	loader: ({ context: { queryClient }, params: { eventId } }) =>
		Promise.all([
			queryClient
				.ensureQueryData(adminEventDetailsQueryOptions(eventId))
				.catch(() => undefined),
			queryClient
				.ensureQueryData(adminEventFilterOptionsQueryOptions)
				.catch(() => undefined),
		]),
	head: ({ loaderData, params }) =>
		adminPageHead(
			loaderData?.[0]?.sessions.find((row) => row.id === params.sessionId)
				?.title ?? admin_events_title(),
		),
	component: SessionPage,
});

/** One session of the programme: its details and its own programme to edit (F33). */
function SessionPage() {
	const { eventId, sessionId } = Route.useParams();
	const view = Route.useSearch().agenda ?? "list";
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const locale = getLocale();
	const { data: event, error } = useQuery(
		adminEventDetailsQueryOptions(eventId),
	);
	const { data: filterOptions } = useQuery(adminEventFilterOptionsQueryOptions);
	const handleChanged = () =>
		queryClient.invalidateQueries({ queryKey: ["admin", "event", eventId] });
	const handleViewChange = (next: "list" | "calendar") =>
		void navigate({
			search: (prev) => ({
				...prev,
				agenda: next === "list" ? undefined : next,
			}),
			replace: true,
			resetScroll: false,
		});

	const back = (
		<Link
			to="/events/$eventId"
			params={{ eventId }}
			className="text-sm text-muted-foreground hover:underline"
		>
			← {admin_session_back()}
		</Link>
	);
	if (error) {
		return (
			<div className="flex flex-col gap-4">
				{back}
				<p className="text-muted-foreground">
					{getAppErrorCode(error) === "FORBIDDEN"
						? admin_event_forbidden()
						: formatMutationError(error, admin_error_generic)}
				</p>
			</div>
		);
	}
	if (!event) {
		return null;
	}
	const session = event.sessions.find((row) => row.id === sessionId);
	if (!session || event.access !== "manage") {
		return (
			<div className="flex flex-col gap-4">
				{back}
				<p className="text-muted-foreground">
					{session ? admin_event_forbidden() : error_session_not_found()}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{back}
			<header className="flex gap-3">
				<span
					aria-hidden
					className={cn(
						"w-1.5 shrink-0 rounded-full",
						sessionColorClasses[session.color].bar,
					)}
				/>
				<div className="flex min-w-0 flex-col gap-1">
					<p className="text-sm text-muted-foreground">{event.title}</p>
					<h1 className="text-2xl font-semibold tracking-tight break-words">
						{session.title}
					</h1>
					<p className="text-sm tabular-nums">
						{formatEventDateTime(session.startsAt, locale)}–
						{formatEventTime(session.endsAt, locale)}
						{session.locationLabel ? ` · ${session.locationLabel}` : ""}
					</p>
					{session.description ? (
						<p className="text-sm text-muted-foreground break-words">
							{session.description}
						</p>
					) : null}
				</div>
			</header>
			<AgendaEditor
				eventId={event.id}
				eventDate={new Date(event.date)}
				agenda={event.agenda.filter((item) => item.sessionId === session.id)}
				session={session}
				options={filterOptions}
				onChanged={handleChanged}
				view={view}
				onViewChange={handleViewChange}
			/>
		</div>
	);
}
