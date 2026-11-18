import { myRegistrationsQueryOptions } from "@repo/api/events/my-registrations";
import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import {
	event_details_back,
	event_details_not_found,
} from "@repo/i18n/paraglide/messages";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, type ReactNode, Suspense } from "react";
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
	loader: async ({ context: { queryClient, user }, params }) => {
		await queryClient.ensureQueryData(eventDetailsQueryOptions(params.eventId));
		if (user) {
			await queryClient.ensureQueryData(myRegistrationsQueryOptions);
		}
	},
	component: EventDetailsPage,
	errorComponent: EventDetailsError,
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
	const registrations = useEventDetailsRegistrations(
		eventId,
		user?.id,
		event.agenda.map((item) => item.id),
	);

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
					/>
				}
			>
				<Suspense
					fallback={
						<EventDetailsView
							{...props}
							interactive={false}
							itemCounts={staticItemCounts}
						/>
					}
				>
					<EventDetailsLive {...props} />
				</Suspense>
			</ClientOnly>
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
