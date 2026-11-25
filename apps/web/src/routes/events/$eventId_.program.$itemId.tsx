import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import { siteUrlQueryOptions } from "@repo/api/site";
import {
	agenda_item_back,
	agenda_item_not_found,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { sharePreviewHead } from "@repo/router-utils/metadata/page-head";
import { formatEventDateTime } from "@repo/ui/time";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";
import { ClientOnly } from "~/components/client-only";
import { AgendaItemPage } from "~/components/event-details/agenda-item-page";
import { loadEventDetails } from "~/lib/event-details/load-event-details";
import { useEventDetailsRegistrations } from "~/lib/event-details/use-event-details-registrations";

/** A programme item's own page (F18): everything about it, shareable. Reads the event page's data. */
export const Route = createFileRoute("/events/$eventId_/program/$itemId")({
	validateSearch: z.object({
		invite: z.string().max(128).optional().catch(undefined),
	}),
	loaderDeps: ({ search }) => ({ invite: search.invite }),
	loader: async ({
		context: { queryClient, user },
		params,
		location,
		deps,
	}) => {
		const event = await loadEventDetails(
			queryClient,
			params.eventId,
			deps.invite,
			location.href,
		);
		const item = event.agenda.find((entry) => entry.id === params.itemId);
		if (!item) {
			throw notFound();
		}
		const [siteUrl] = await Promise.all([
			queryClient.ensureQueryData(siteUrlQueryOptions),
			user ? queryClient.ensureQueryData(myRegistrationsQueryOptions) : null,
		]);
		const locale = getLocale();
		return {
			preview: {
				title: item.title,
				description:
					item.description?.trim().slice(0, 200) ||
					`${event.title} · ${formatEventDateTime(item.startsAt, locale)}`,
				url: `${siteUrl}/${locale}/events/${event.id}/program/${item.id}`,
			},
		};
	},
	head: ({ loaderData }) =>
		loaderData ? sharePreviewHead(loaderData.preview) : { meta: [] },
	component: AgendaItemRoute,
	errorComponent: ItemError,
	notFoundComponent: ItemNotFound,
});

function PageShell({ children }: { children: ReactNode }) {
	const { eventId } = Route.useParams();
	const { invite } = Route.useSearch();
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
			<Link
				to="/events/$eventId"
				params={{ eventId }}
				search={{ invite }}
				className="self-start font-mono text-sm font-bold underline-offset-4 hover:underline"
			>
				← {agenda_item_back()}
			</Link>
			{children}
		</div>
	);
}

function AgendaItemRoute() {
	const { eventId, itemId } = Route.useParams();
	const { user } = Route.useRouteContext();
	const { invite } = Route.useSearch();
	const query = useSuspenseQuery(eventDetailsQueryOptions(eventId, invite));
	const registrations = useEventDetailsRegistrations(eventId, user?.id);
	const item = query.data.agenda.find((entry) => entry.id === itemId);
	if (!item) {
		return <ItemNotFound />;
	}
	const props = {
		event: query.data,
		item,
		user,
		registrations,
		updatedAt: query.dataUpdatedAt,
	};
	return (
		<PageShell>
			<ClientOnly fallback={<AgendaItemPage {...props} interactive={false} />}>
				<AgendaItemPage {...props} interactive />
			</ClientOnly>
		</PageShell>
	);
}

function ItemNotFound() {
	return (
		<PageShell>
			<p className="text-muted-foreground">{agenda_item_not_found()}</p>
		</PageShell>
	);
}

function ItemError({ error }: { error: unknown }) {
	return (
		<PageShell>
			<p className="text-muted-foreground">
				{error instanceof Error ? error.message : String(error)}
			</p>
		</PageShell>
	);
}
