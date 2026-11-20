import { publishAdminEventServer } from "@repo/api/admin/mutations";
import type { AdminEventDetails } from "@repo/api/admin/queries";
import {
	admin_error_generic,
	admin_event_back,
	admin_event_edit,
	admin_event_places,
	admin_event_publish,
	admin_event_published,
	admin_event_status_draft,
	admin_publish_missing_both,
	admin_publish_missing_link,
	admin_publish_missing_place,
	admin_scan_open,
	event_room,
	event_status_cancelled,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { AttendanceModeBadge } from "@repo/ui/composed/events/attendance-mode-badge";
import { formatEventDateTime } from "@repo/ui/time";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { EventFormDialog } from "../event-form-dialog";
import { CancelEventButton } from "./cancel-event-button";
import { DuplicateEventDialog } from "./duplicate-event-dialog";
import { MessageDialog } from "./message-dialog";

const MISSING_MESSAGE: Record<string, () => string> = {
	place: admin_publish_missing_place,
	link: admin_publish_missing_link,
	"place+link": admin_publish_missing_both,
};

type EventSummaryCardProps = {
	event: AdminEventDetails;
	onChanged: () => Promise<unknown>;
};

export function EventSummaryCard({ event, onChanged }: EventSummaryCardProps) {
	const locale = getLocale();
	const registered = event.maxSeats - event.seatsRemaining;
	const missing = event.missingForPublish;
	const [editOpen, setEditOpen] = useState(false);
	const publishMutation = useMutation({
		mutationFn: () => publishAdminEventServer({ data: { id: event.id } }),
		onSuccess: async () => {
			toast.success(admin_event_published());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	return (
		<section className="flex flex-col gap-3">
			<Link
				to="/events"
				className="text-sm text-muted-foreground hover:underline"
			>
				← {admin_event_back()}
			</Link>
			<h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
			<p className="text-muted-foreground">
				{formatEventDateTime(event.date, locale)}
				{event.endsAt ? ` – ${formatEventDateTime(event.endsAt, locale)}` : ""}
			</p>
			<div className="flex flex-wrap gap-2">
				{event.status === "draft" ? (
					<Badge>{admin_event_status_draft()}</Badge>
				) : null}
				{event.status === "cancelled" ? (
					<Badge variant="destructive">{event_status_cancelled()}</Badge>
				) : null}
				<AttendanceModeBadge mode={event.attendanceMode} />
				<Badge variant="secondary">{event.typeLabel}</Badge>
				{event.facultyLabel ? (
					<Badge variant="outline">{event.facultyLabel}</Badge>
				) : null}
				{event.locationLabel ? (
					<Badge variant="outline">{event.locationLabel}</Badge>
				) : null}
				{event.room ? (
					<Badge variant="outline">{event_room({ room: event.room })}</Badge>
				) : null}
			</div>
			<p className="tabular-nums">
				{admin_event_places({ registered, max: event.maxSeats })}
			</p>
			{event.status === "draft" ? (
				<div className="flex flex-col items-start gap-2">
					{missing.length > 0 ? (
						<p className="text-sm text-muted-foreground">
							{MISSING_MESSAGE[missing.join("+")]?.()}
						</p>
					) : null}
					<Button
						onClick={() => publishMutation.mutate()}
						disabled={publishMutation.isPending || missing.length > 0}
					>
						{admin_event_publish()}
					</Button>
				</div>
			) : null}
			<div className="flex flex-wrap gap-2">
				{event.status !== "cancelled" ? (
					<Button variant="outline" onClick={() => setEditOpen(true)}>
						{admin_event_edit()}
					</Button>
				) : null}
				<DuplicateEventDialog eventId={event.id} />
				<MessageDialog eventId={event.id} />
				{event.status === "published" ? (
					<Button variant="outline" asChild>
						<Link to="/events/$eventId/scan" params={{ eventId: event.id }}>
							{admin_scan_open()}
						</Link>
					</Button>
				) : null}
				{event.status === "published" &&
				new Date(event.effectiveEndsAt).getTime() > Date.now() ? (
					<CancelEventButton eventId={event.id} onCancelled={onChanged} />
				) : null}
			</div>
			{event.description ? (
				<p className="max-w-prose whitespace-pre-line text-sm">
					{event.description}
				</p>
			) : null}
			<EventFormDialog
				open={editOpen}
				onOpenChange={setEditOpen}
				event={event}
				onSaved={onChanged}
			/>
		</section>
	);
}
