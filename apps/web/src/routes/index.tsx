import { ensureMyRegistrations } from "@repo/api/events/my-registrations";
import { prefetchEventData } from "@repo/api/events/queries";
import {
	eventSearchSchema,
	toEventFiltersParams,
} from "@repo/api/events/schemas";
import { siteUrlQueryOptions } from "@repo/api/site";
import {
	calendar_campus_subscribe,
	home_description,
	home_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { EventErrorAlert } from "@repo/ui/composed/events/event-error-alert";
import { EventFilters } from "@repo/ui/composed/events/event-filters";
import { PageHeader } from "@repo/ui/composed/page-header";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HomeEventListSection } from "~/components/home-event-list-section";

export const Route = createFileRoute("/")({
	validateSearch: eventSearchSchema,
	loaderDeps: ({ search }) => toEventFiltersParams(search),
	loader: async ({ context: { queryClient, user }, deps }) => {
		await Promise.all([
			prefetchEventData(queryClient, deps),
			queryClient.ensureQueryData(siteUrlQueryOptions),
			user ? ensureMyRegistrations(queryClient) : null,
		]);
	},
	component: HomePage,
	errorComponent: HomePageError,
});

function HomeShell({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-6 p-8">
			<PageHeader title={home_title()} description={home_description()} />
			{children}
		</div>
	);
}

function HomePage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const filters = Route.useLoaderDeps();
	const { user } = Route.useRouteContext();

	return (
		<HomeShell>
			<EventFilters
				search={search}
				onSearchChange={(updater, options) =>
					navigate({ search: updater, replace: options?.replace })
				}
			/>
			<HomeEventListSection filters={filters} user={user} />
			<CampusCalendarLink />
		</HomeShell>
	);
}

function HomePageError({ error }: { error: unknown }) {
	return (
		<HomeShell>
			<EventErrorAlert error={error} />
		</HomeShell>
	);
}

/** Subscribe to every public event in a calendar app (webcal opens the app directly). */
function CampusCalendarLink() {
	const { data: siteUrl } = useQuery(siteUrlQueryOptions);
	if (!siteUrl) {
		return null;
	}
	const feed = `${siteUrl.replace(/^https?:/, "webcal:")}/api/calendar/events?lang=${getLocale()}`;
	return (
		<a
			href={feed}
			className="self-center text-sm text-muted-foreground underline underline-offset-2"
		>
			{calendar_campus_subscribe()}
		</a>
	);
}
