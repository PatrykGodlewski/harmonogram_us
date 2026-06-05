import { events_empty, events_loading } from "@repo/i18n/paraglide/messages";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { EventErrorAlert } from "@repo/ui/composed/events/event-error-alert";
import type { ReactNode } from "react";
import type { HomeEventListEvent } from "~/lib/events/types";

type HomeEventListShellProps = {
	error: unknown;
	isError: boolean;
	loading: boolean;
	events: HomeEventListEvent[];
	children: ReactNode;
};

export function HomeEventListShell({
	error,
	isError,
	loading,
	events,
	children,
}: HomeEventListShellProps) {
	if (isError) return <EventErrorAlert error={error} />;

	if (loading) {
		return (
			<div className="flex flex-col gap-4" role="status" aria-busy="true">
				<span className="sr-only">{events_loading()}</span>
				{(["skeleton-a", "skeleton-b", "skeleton-c"] as const).map((key) => (
					<Card key={key} aria-hidden>
						<CardContent className="py-8">
							<Skeleton className="h-16 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		);
	}

	if (events.length === 0) {
		return (
			<Card className="min-h-28">
				<CardContent className="flex min-h-28 items-center justify-center">
					<p className="text-muted-foreground">{events_empty()}</p>
				</CardContent>
			</Card>
		);
	}

	return children;
}
