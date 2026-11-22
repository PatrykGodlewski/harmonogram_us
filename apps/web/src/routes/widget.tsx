import {
	widgetEventsQueryOptions,
	widgetSearchSchema,
} from "@repo/api/public/widget";
import {
	widget_all_events,
	widget_empty,
	widget_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale, localizeHref } from "@repo/i18n/paraglide/runtime";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { formatEventDateTime } from "@repo/ui/time";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/widget")({
	validateSearch: widgetSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context: { queryClient }, deps }) =>
		queryClient.ensureQueryData(widgetEventsQueryOptions(deps)),
	head: () => studentsPageHead(widget_title()),
	component: WidgetPage,
});

/**
 * "Upcoming events" for other sites to embed in an iframe (F24). The root
 * layout leaves out the site header and footer here; links open a new tab so
 * the host page stays where it is.
 */
function WidgetPage() {
	const search = Route.useSearch();
	const { data: events } = useSuspenseQuery(widgetEventsQueryOptions(search));
	const locale = getLocale();
	const allEvents = localizeHref(
		search.faculty
			? `/?facultyFilter=${encodeURIComponent(search.faculty)}`
			: "/",
	);

	return (
		<main className="flex flex-col gap-3 p-3">
			<h1 className="text-base font-semibold">{widget_title()}</h1>
			{events.length === 0 ? (
				<p className="text-sm text-muted-foreground">{widget_empty()}</p>
			) : (
				<ul className="flex flex-col divide-y rounded-lg border">
					{events.map((event) => (
						<li key={event.id} className="flex flex-col gap-0.5 p-3">
							<a
								href={localizeHref(`/events/${encodeURIComponent(event.id)}`)}
								target="_blank"
								rel="noopener"
								className="font-medium break-words text-primary underline-offset-2 hover:underline"
							>
								{event.title}
							</a>
							<span className="text-sm text-muted-foreground">
								{formatEventDateTime(event.startsAt, locale)}
								{event.place ? ` · ${event.place}` : null}
							</span>
						</li>
					))}
				</ul>
			)}
			<a
				href={allEvents}
				target="_blank"
				rel="noopener"
				className="text-sm text-primary underline underline-offset-2"
			>
				{widget_all_events()}
			</a>
		</main>
	);
}
