import { event_room, indico_badge } from "@repo/i18n/paraglide/messages";
import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { formatEventDateForLocale } from "~/lib/events/format-event-date";
import type { IndicoListEvent } from "~/lib/events/types";

/** A read-only event from the university's Indico: it links there, registration happens there. */
export function IndicoEventCard({ event }: { event: IndicoListEvent }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<a href={event.url} className="hover:underline">
						{event.title}
					</a>
				</CardTitle>
				<CardDescription>
					{formatEventDateForLocale(event.startsAt)}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					<Badge variant="secondary">{indico_badge()}</Badge>
					{event.location ? (
						<Badge variant="outline">{event.location}</Badge>
					) : null}
					{event.room ? (
						<Badge variant="outline">{event_room({ room: event.room })}</Badge>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
