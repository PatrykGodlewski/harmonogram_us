import { myRegistrationListQueryOptions } from "@repo/api/events/my-registration-list";
import type { MyRegistrationListItem } from "@repo/db/queries/my-registrations";
import {
	account_my_registrations,
	account_open_event,
	account_past,
	account_registrations_empty,
	account_section_empty,
	account_ticket,
	account_upcoming,
	account_waitlisted,
	events_registered,
	events_unregister,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { formatEventDateTime, formatEventTime } from "@repo/ui/time";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { UnregisterEventDialog } from "~/components/event-details/unregister-event-dialog";
import { useRegistrationActions } from "~/lib/registration/use-registration-actions";

/** The user's registrations, upcoming and past, on the account page. */
export function MyRegistrations() {
	const { data: registrations } = useSuspenseQuery(
		myRegistrationListQueryOptions,
	);
	const now = Date.now();
	const upcoming = registrations.filter(
		(row) => new Date(row.effectiveEndsAt).getTime() > now,
	);
	const past = registrations
		.filter((row) => new Date(row.effectiveEndsAt).getTime() <= now)
		.reverse();

	return (
		<section className="mt-6 rounded-lg border p-4">
			<h2 className="mb-4 text-lg font-semibold">
				{account_my_registrations()}
			</h2>
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
					<RegistrationGroup
						title={account_past()}
						rows={past}
						canWithdraw={false}
					/>
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
			<h3 id={headingId} className="text-sm font-medium text-muted-foreground">
				{title}
			</h3>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{account_section_empty()}
				</p>
			) : (
				<ul className="divide-y">
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

function RegistrationRow({
	row,
	canWithdraw,
}: {
	row: MyRegistrationListItem;
	canWithdraw: boolean;
}) {
	const locale = getLocale();
	const actions = useRegistrationActions();
	const handleWithdraw = () => actions.unregister(row.eventId);

	return (
		<li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex flex-col gap-1">
				<p className="font-medium">{row.title}</p>
				<p className="text-sm text-muted-foreground tabular-nums">
					{formatEventDateTime(row.date, locale)}
					{row.locationLabel ? ` · ${row.locationLabel}` : ""}
				</p>
				<div>
					<Badge variant={row.state === "registered" ? "default" : "secondary"}>
						{row.state === "registered"
							? events_registered()
							: account_waitlisted({ position: row.waitlistPosition ?? 0 })}
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
				{row.state === "registered" ? (
					<Button size="sm" variant="outline" asChild>
						<Link
							to="/tickets/$registrationId"
							params={{ registrationId: row.registrationId }}
						>
							{account_ticket()}
						</Link>
					</Button>
				) : null}
				{canWithdraw ? (
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
		</li>
	);
}
