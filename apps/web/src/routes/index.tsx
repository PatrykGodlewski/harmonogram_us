import { ensureMyRegisteredEventIds } from "@repo/api/events/my-registrations";
import { prefetchEventData } from "@repo/api/events/queries";
import {
	eventSearchSchema,
	toEventFiltersParams,
} from "@repo/api/events/schemas";
import { home_description, home_title } from "@repo/i18n/paraglide/messages";
import { EventErrorAlert } from "@repo/ui/composed/events/event-error-alert";
import { EventFilters } from "@repo/ui/composed/events/event-filters";
import { PageHeader } from "@repo/ui/composed/page-header";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HomeEventListSection } from "~/components/home-event-list-section";

export const Route = createFileRoute("/")({
	validateSearch: eventSearchSchema,
	loaderDeps: ({ search }) => toEventFiltersParams(search),
	loader: async ({ context: { queryClient, user }, deps }) => {
		await prefetchEventData(queryClient, deps);
		if (user) {
			await ensureMyRegisteredEventIds(queryClient);
		}
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
