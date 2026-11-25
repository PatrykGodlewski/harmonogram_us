import type { AdminEventDetails } from "@repo/api/admin/queries";
import {
	admin_event_back,
	admin_event_edit,
	admin_event_status_draft,
	admin_event_status_ended,
	admin_registered_label,
	admin_scan_open,
	admin_seats_left_label,
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
	const hasEnded = new Date(event.effectiveEndsAt).getTime() <= Date.now();

	return (
		<section className="flex flex-col gap-3">
			<Link
				to="/events"
				className="self-start font-mono text-sm font-bold underline-offset-4 hover:underline"
			>
				← {admin_event_back()}
			</Link>
			<header className="border border-navy bg-green">
				<div className="flex items-center justify-between gap-3 border-b border-navy px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase">
					<span className="truncate">{event.typeLabel}</span>
					<AttendanceModeBadge mode={event.attendanceMode} />
				</div>
				<div className="flex flex-col gap-2 p-4 sm:p-6">
					<h1 className="text-[clamp(1.5rem,5vw,2.25rem)] leading-tight">
						{event.title}
					</h1>
					<p className="font-mono text-sm">
						{formatEventDateTime(event.date, locale)}
						{event.endsAt
							? ` – ${formatEventDateTime(event.endsAt, locale)}`
							: ""}
					</p>
				</div>
				<dl className="grid grid-cols-2 border-t border-navy bg-manela">
					<div className="border-r border-navy px-4 py-3">
						<dt className="font-mono text-xs font-bold tracking-widest uppercase">
							{admin_registered_label()}
						</dt>
						<dd className="font-pixel text-2xl tabular-nums">
							{registered} / {event.maxSeats}
						</dd>
					</div>
					<div className="px-4 py-3">
						<dt className="font-mono text-xs font-bold tracking-widest uppercase">
							{admin_seats_left_label()}
						</dt>
						<dd className="font-pixel text-2xl tabular-nums">
							{event.seatsRemaining}
						</dd>
					</div>
				</dl>
			</header>
			<div className="flex flex-wrap gap-2">
				{event.status === "draft" ? (
					<Badge>{admin_event_status_draft()}</Badge>
				) : null}
				{event.status === "cancelled" ? (
					<Badge variant="destructive">{event_status_cancelled()}</Badge>
				) : null}
				{event.status === "published" && hasEnded ? (
					<Badge variant="outline">{admin_event_status_ended()}</Badge>
				) : null}
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
			{/* Two equal columns on a phone instead of one button per row. */}
			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
						{event.status === "published" && !hasEnded ? (
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
