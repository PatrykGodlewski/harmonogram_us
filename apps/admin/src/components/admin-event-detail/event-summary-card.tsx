import type { AdminEventDetails } from "@repo/api/admin/queries";
import {
	admin_event_back,
	admin_event_edit,
	admin_event_places,
	admin_event_status_draft,
	admin_scan_open,
	admin_summary_requires_approval,
	event_room,
	event_status_cancelled,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { AttendanceModeBadge } from "@repo/ui/composed/events/attendance-mode-badge";
import { formatEventDateTime } from "@repo/ui/time";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { EventFormDialog } from "../event-form-dialog";
import { CancelEventButton } from "./cancel-event-button";
import { DuplicateEventDialog } from "./duplicate-event-dialog";
import { InviteDialog } from "./invite-dialog";
import { InviteLinkCard } from "./invite-link-card";
import { MessageDialog } from "./message-dialog";
import { PublishChecklist } from "./publish-checklist";

type EventSummaryCardProps = {
	event: AdminEventDetails;
	onChanged: () => Promise<unknown>;
};

export function EventSummaryCard({ event, onChanged }: EventSummaryCardProps) {
	const locale = getLocale();
	const registered = event.maxSeats - event.seatsRemaining;
	const [editOpen, setEditOpen] = useState(false);
	// A check-in helper sees the event and the scanner, nothing that changes it.
	const canManage = event.access === "manage";

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
				{event.requiresApproval ? (
					<Badge variant="outline">{admin_summary_requires_approval()}</Badge>
				) : null}
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
			{event.inviteToken ? (
				<InviteLinkCard
					eventId={event.id}
					inviteToken={event.inviteToken}
					onChanged={onChanged}
				/>
			) : null}
			{canManage && event.status === "draft" ? (
				<PublishChecklist event={event} onChanged={onChanged} />
			) : null}
			<div className="flex flex-wrap gap-2">
				{event.status === "published" ? (
					<Button variant="outline" asChild>
						<Link to="/events/$eventId/scan" params={{ eventId: event.id }}>
							{admin_scan_open()}
						</Link>
					</Button>
				) : null}
				{canManage ? (
					<>
						{event.status !== "cancelled" ? (
							<Button variant="outline" onClick={() => setEditOpen(true)}>
								{admin_event_edit()}
							</Button>
						) : null}
						<DuplicateEventDialog eventId={event.id} />
						<MessageDialog eventId={event.id} />
						{event.status === "published" ? (
							<InviteDialog eventId={event.id} />
						) : null}
						{event.status === "published" &&
						new Date(event.effectiveEndsAt).getTime() > Date.now() ? (
							<CancelEventButton eventId={event.id} onCancelled={onChanged} />
						) : null}
					</>
				) : null}
			</div>
			{event.description ? (
				<p className="max-w-prose whitespace-pre-line text-sm">
					{event.description}
				</p>
			) : null}
			{canManage ? (
				<EventFormDialog
					open={editOpen}
					onOpenChange={setEditOpen}
					event={event}
					onSaved={onChanged}
				/>
			) : null}
		</section>
	);
}
