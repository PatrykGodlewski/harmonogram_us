import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import {
	type EventDetails,
	eventDetailsQueryOptions,
} from "@repo/api/events/queries";
import { siteUrlQueryOptions } from "@repo/api/site";
import {
	event_details_back,
	event_details_not_found,
	joined_toast,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { formatEventDateTime } from "@repo/ui/time";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ClientOnly } from "~/components/client-only";
import { EventDetailsView } from "~/components/event-details/event-details-view";
import { useEventDetailsRegistrations } from "~/lib/event-details/use-event-details-registrations";

const EventDetailsLive = lazy(
	() => import("~/components/event-details/event-details-live"),
);

const staticItemCounts = {
	getItemCount: <T,>(_itemId: string, fallback: T) => fallback,
};

export const Route = createFileRoute("/events/$eventId")({
	validateSearch: z.object({
		joined: z.coerce.number().optional().catch(undefined),
		agenda: z.enum(["list", "calendar"]).optional().catch(undefined),
	}),
	loader: async ({ context: { queryClient, user }, params, location }) => {
		let event: EventDetails;
		try {
			event = await queryClient.ensureQueryData(
				eventDetailsQueryOptions(params.eventId),
			);
		} catch (error) {
			// A deleted or unknown event is a 404 page, not a server error.
			if (error instanceof Error && error.message === "EVENT_NOT_FOUND") {
				throw notFound();
			}
			// A signed-in-only event: sign in, then come back here.
			if (error instanceof Error && error.message === "UNAUTHORIZED") {
				throw redirect({
					to: "/login",
					search: { redirect: location.href },
				});
			}
			throw error;
		}
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
	head: ({ loaderData }) => ({
		meta: loaderData
			? [
					{ title: loaderData.preview.title },
					{ name: "description", content: loaderData.preview.description },
					{ property: "og:type", content: "website" },
					{ property: "og:title", content: loaderData.preview.title },
					{
						property: "og:description",
						content: loaderData.preview.description,
					},
					{ property: "og:url", content: loaderData.preview.url },
				]
			: [],
	}),
	component: EventDetailsPage,
	errorComponent: EventDetailsError,
	notFoundComponent: EventNotFound,
});

function PageShell({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
			<Link to="/" className="text-sm text-muted-foreground hover:underline">
				← {event_details_back()}
			</Link>
			{children}
		</div>
	);
}

function EventDetailsPage() {
	const { eventId } = Route.useParams();
	const { user } = Route.useRouteContext();
	const { data: event } = useSuspenseQuery(eventDetailsQueryOptions(eventId));
	const { joined } = Route.useSearch();
	const navigate = useNavigate();
	useEffect(() => {
		if (joined) {
			toast.success(joined_toast());
			void navigate({ to: ".", search: {}, replace: true });
		}
	}, [joined, navigate]);
	const registrations = useEventDetailsRegistrations(eventId, user?.id);

	const props = {
		event,
		user,
		registrations,
		eventSeatCount: {
			seatsRemaining: event.seatsRemaining,
			maxSeats: event.maxSeats,
		},
	};

	return (
		<PageShell>
			<ClientOnly
				fallback={
					<EventDetailsView
						{...props}
						interactive={false}
						itemCounts={staticItemCounts}
						isCancelled={event.status === "cancelled"}
					/>
				}
			>
				<Suspense
					fallback={
						<EventDetailsView
							{...props}
							interactive={false}
							itemCounts={staticItemCounts}
							isCancelled={event.status === "cancelled"}
						/>
					}
				>
					<EventDetailsLive {...props} />
				</Suspense>
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
