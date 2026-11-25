import { myRegistrationListQueryOptions } from "@repo/api/events/my-registration-list";
import type { MyRegistrationListItem } from "@repo/db/queries/my-registrations";
import {
	account_archive,
	account_my_registrations,
	account_open_event,
	account_pending,
	account_registrations_empty,
	account_rejected,
	account_section_empty,
	account_ticket,
	account_upcoming,
	account_waitlisted,
	certificate_download,
	event_status_cancelled,
	events_registered,
	events_unregister,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	eventDateStamp,
	formatEventDateTime,
	formatEventTime,
} from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { UnregisterEventDialog } from "~/components/event-details/unregister-event-dialog";
import { useMyRegistrations } from "~/lib/registration/use-my-registrations";
import { useRegistrationActions } from "~/lib/registration/use-registration-actions";

/** The user's registrations, upcoming and past, on the account page. */
export function MyRegistrations({ userId }: { userId: string }) {
	const { data: list } = useSuspenseQuery(myRegistrationListQueryOptions);
	// State and waitlist position come from the live-refreshed registrations every screen
	// uses (a promotion shows here too); this list only adds the event details.
	const { byEvent } = useMyRegistrations(userId);
	const registrations = list.map((row) => ({
		...row,
		...byEvent.get(row.eventId),
	}));
	const now = Date.now();
	const upcoming = registrations.filter(
		(row) => new Date(row.effectiveEndsAt).getTime() > now,
	);
	const past = registrations
		.filter((row) => new Date(row.effectiveEndsAt).getTime() <= now)
		.reverse();

	return (
		<section className="flex flex-col gap-4">
			<h2 className="mb-4 text-xl">{account_my_registrations()}</h2>
			{registrations.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{account_registrations_empty()}
				</p>
			) : (
				<div className="flex flex-col gap-6">
					<RegistrationGroup
						title={account_upcoming()}
						rows={upcoming}
						canWithdraw
					/>
					{past.length > 0 ? <RegistrationArchive rows={past} /> : null}
				</div>
			)}
		</section>
	);
}

function RegistrationGroup({
	title,
	rows,
	canWithdraw,
}: {
	title: string;
	rows: MyRegistrationListItem[];
	canWithdraw: boolean;
}) {
	const headingId = React.useId();
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2">
			<h3
				id={headingId}
				className="font-mono text-xs font-bold tracking-widest uppercase"
			>
				{title}
			</h3>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{account_section_empty()}
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{rows.map((row) => (
						<RegistrationRow
							key={row.registrationId}
							row={row}
							canWithdraw={canWithdraw}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

/** Events that have ended: folded away, with no actions but opening the event (and a certificate). */
function RegistrationArchive({ rows }: { rows: MyRegistrationListItem[] }) {
	return (
		<details className="group flex flex-col gap-2">
			<summary className="cursor-pointer font-mono text-xs font-bold tracking-widest uppercase">
				{account_archive({ count: rows.length })}
			</summary>
			<ul className="mt-3 flex flex-col gap-3">
				{rows.map((row) => (
					<RegistrationRow
						key={row.registrationId}
						row={row}
						canWithdraw={false}
						archived
					/>
				))}
			</ul>
		</details>
	);
}

function stateLabel(row: MyRegistrationListItem): string {
	switch (row.state) {
		case "registered":
			return events_registered();
		case "waitlisted":
			return account_waitlisted({ position: row.waitlistPosition ?? 0 });
		case "pending":
			return account_pending();
		case "rejected":
			return account_rejected();
	}
}

function RegistrationRow({
	row,
	canWithdraw,
	archived = false,
}: {
	archived?: boolean;
	row: MyRegistrationListItem;
	canWithdraw: boolean;
}) {
	const locale = getLocale();
	const actions = useRegistrationActions();
	const handleWithdraw = () => actions.unregister(row.eventId);
	const isCancelled = row.eventStatus === "cancelled";
	const stamp = eventDateStamp(row.date, locale);

	return (
		<li
			className={cn(
				"grid grid-cols-[4.5rem_1fr] border border-navy",
				archived ? "bg-manela" : "bg-white",
			)}
		>
			{/* A ticket stub: the day in pixels, the month under it. */}
			<p
				aria-hidden
				className="flex flex-col items-center justify-center gap-1 border-r border-dashed border-navy py-3"
			>
				<span className="font-pixel text-3xl leading-none tabular-nums">
					{stamp.day}
				</span>
				<span className="font-mono text-xs font-bold tracking-widest uppercase">
					{stamp.month}
				</span>
			</p>
			<div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 flex-col gap-1">
					<p className="font-bold break-words">{row.title}</p>
					<p className="text-sm text-muted-foreground tabular-nums">
						{formatEventDateTime(row.date, locale)}
						{row.locationLabel ? ` · ${row.locationLabel}` : ""}
					</p>
					<div className="flex flex-wrap gap-2">
						{isCancelled ? (
							<Badge variant="destructive">{event_status_cancelled()}</Badge>
						) : null}
						<Badge
							variant={row.state === "registered" ? "default" : "secondary"}
						>
							{stateLabel(row)}
						</Badge>
					</div>
					{row.items.length > 0 ? (
						<ul className="text-sm text-muted-foreground">
							{row.items.map((item) => (
								<li key={item.id} className="tabular-nums">
									{formatEventTime(item.startsAt, locale)} {item.title}
								</li>
							))}
						</ul>
					) : null}
				</div>
				<div className="flex flex-wrap gap-2 sm:shrink-0">
					<Button size="sm" variant="outline" asChild>
						<Link to="/events/$eventId" params={{ eventId: row.eventId }}>
							{account_open_event()}
						</Link>
					</Button>
					{row.state === "registered" && !isCancelled && !archived ? (
						<Button size="sm" variant="outline" asChild>
							<Link
								to="/tickets/$registrationId"
								params={{ registrationId: row.registrationId }}
							>
								{account_ticket()}
							</Link>
						</Button>
					) : null}
					{row.certificateAvailable ? (
						<Button size="sm" variant="outline" asChild>
							<a href={`/api/certificates/${row.registrationId}`} download>
								{certificate_download()}
							</a>
						</Button>
					) : null}
					{canWithdraw && !isCancelled && row.state !== "rejected" ? (
						<UnregisterEventDialog onConfirm={handleWithdraw}>
							<Button
								size="sm"
								variant="outline"
								disabled={actions.isPending("unregister", row.eventId)}
							>
								{events_unregister()}
							</Button>
						</UnregisterEventDialog>
					) : null}
				</div>
			</div>
		</li>
	);
}
