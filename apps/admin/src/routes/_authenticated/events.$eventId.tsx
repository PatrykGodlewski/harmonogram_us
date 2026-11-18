import {
	adminEventDetailsQueryOptions,
	adminEventFilterOptionsQueryOptions,
	adminEventRegistrantsQueryOptions,
} from "@repo/api/admin/queries";
import { admin_error_generic } from "@repo/i18n/paraglide/messages";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AgendaEditor } from "~/components/admin-event-detail/agenda-editor";
import { EventSummaryCard } from "~/components/admin-event-detail/event-summary-card";
import { RegistrantsList } from "~/components/admin-event-detail/registrants-list";
import { formatMutationError } from "~/lib/format-mutation-error";

export const Route = createFileRoute("/_authenticated/events/$eventId")({
	component: AdminEventDetailPage,
});

function AdminEventDetailPage() {
	const { eventId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: event, error } = useQuery(
		adminEventDetailsQueryOptions(eventId),
	);
	const { data: registrants = [] } = useQuery(
		adminEventRegistrantsQueryOptions(eventId),
	);
	const { data: filterOptions } = useQuery(adminEventFilterOptionsQueryOptions);

	const handleChanged = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: ["admin", "event", eventId] }),
			queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
		]);

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

	return (
		<div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div className="flex flex-col gap-8">
				<EventSummaryCard event={event} />
				<AgendaEditor
					eventId={event.id}
					eventDate={new Date(event.date)}
					agenda={event.agenda}
					locations={filterOptions?.locations ?? []}
					onChanged={handleChanged}
				/>
			</div>
			<RegistrantsList registrants={registrants} agenda={event.agenda} />
		</div>
	);
}
