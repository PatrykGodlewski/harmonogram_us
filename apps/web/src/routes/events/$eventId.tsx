import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import { siteUrlQueryOptions } from "@repo/api/site";
import {
	event_details_back,
	event_details_not_found,
	joined_toast,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { sharePreviewHead } from "@repo/router-utils/metadata/page-head";
import { formatEventDateTime } from "@repo/ui/time";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ClientOnly } from "~/components/client-only";
import { EventDetailsView } from "~/components/event-details/event-details-view";
import { loadEventDetails } from "~/lib/event-details/load-event-details";
import { useEventDetailsRegistrations } from "~/lib/event-details/use-event-details-registrations";

export const Route = createFileRoute("/events/$eventId")({
	validateSearch: z.object({
		joined: z.coerce.number().optional().catch(undefined),
		agenda: z.enum(["list", "calendar"]).optional().catch(undefined),
		/** Shows only the programme held in this place (F33). */
		place: z.string().max(100).optional().catch(undefined),
		/** Shows only the sessions with this title (F33). */
		session: z.string().max(200).optional().catch(undefined),
		/** Shows only what starts on this day, YYYY-MM-DD (multi-day programmes). */
		day: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional()
			.catch(undefined),
		/** The secret of an invite link (invite-only events). */
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
		const [siteUrl] = await Promise.all([
			queryClient.ensureQueryData(siteUrlQueryOptions),
			user ? queryClient.ensureQueryData(myRegistrationsQueryOptions) : null,
		]);
		const when = formatEventDateTime(event.date, getLocale());
		return {
			preview: {
				title: event.title,
				description: event.description?.trim().slice(0, 200) || when,
				url: `${siteUrl}/${getLocale()}/events/${event.id}`,
			},
		};
	},
	// Link previews when the event is shared (Open Graph).
	head: ({ loaderData }) =>
		loaderData ? sharePreviewHead(loaderData.preview) : { meta: [] },
	component: EventDetailsPage,
	errorComponent: EventDetailsError,
	notFoundComponent: EventNotFound,
});

function PageShell({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
			<Link
				to="/"
				className="self-start font-mono text-sm font-bold underline-offset-4 hover:underline"
			>
				← {event_details_back()}
			</Link>
			{children}
		</div>
	);
}

function EventDetailsPage() {
	const { eventId } = Route.useParams();
	const { user } = Route.useRouteContext();
	const { joined, invite } = Route.useSearch();
	const { data: event } = useSuspenseQuery(
		eventDetailsQueryOptions(eventId, invite),
	);
	const navigate = useNavigate();
	useEffect(() => {
		if (joined) {
			toast.success(joined_toast());
			void navigate({ to: ".", search: { invite }, replace: true });
		}
	}, [joined, invite, navigate]);
	const registrations = useEventDetailsRegistrations(eventId, user?.id);

	const props = { event, user, registrations };

	// The query refetches every 15 s, so counts and cancellations stay current. Actions work after hydration.
	return (
		<PageShell>
			<ClientOnly
				fallback={<EventDetailsView {...props} interactive={false} />}
			>
				<EventDetailsView {...props} interactive />
			</ClientOnly>
		</PageShell>
	);
}

function EventNotFound() {
	return (
		<PageShell>
			<p className="text-muted-foreground">{event_details_not_found()}</p>
		</PageShell>
	);
}

function EventDetailsError({ error }: { error: unknown }) {
	const notFound =
		error instanceof Error && error.message === "EVENT_NOT_FOUND";
	return (
		<PageShell>
			<p className="text-muted-foreground">
				{notFound
					? event_details_not_found()
					: error instanceof Error
						? error.message
						: String(error)}
			</p>
		</PageShell>
	);
}
