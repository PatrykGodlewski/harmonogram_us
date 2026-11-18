import type { EventDetails } from "@repo/api/admin/queries";
import {
	admin_event_back,
	admin_event_places,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { formatWarsawDateTime } from "@repo/ui/time";
import { Link } from "@tanstack/react-router";

export function EventSummaryCard({ event }: { event: EventDetails }) {
	const locale = getLocale();
	const registered = event.maxSeats - event.seatsRemaining;

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
				{formatWarsawDateTime(event.date, locale)}
				{event.endsAt ? ` – ${formatWarsawDateTime(event.endsAt, locale)}` : ""}
			</p>
			<div className="flex flex-wrap gap-2">
				<Badge variant="secondary">{event.typeLabel}</Badge>
				{event.facultyLabel ? (
					<Badge variant="outline">{event.facultyLabel}</Badge>
				) : null}
				{event.locationLabel ? (
					<Badge variant="outline">{event.locationLabel}</Badge>
				) : null}
			</div>
			<p className="tabular-nums">
				{admin_event_places({ registered, max: event.maxSeats })}
			</p>
			{event.description ? (
				<p className="max-w-prose whitespace-pre-line text-sm">
					{event.description}
				</p>
			) : null}
		</section>
	);
}
