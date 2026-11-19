import { EVENT_PAGE_SIZE } from "@repo/api/events/schemas";
import {
	events_empty,
	events_loading,
	events_show_more,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { EventErrorAlert } from "@repo/ui/composed/events/event-error-alert";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { HomeEventListEvent } from "~/lib/events/types";

type HomeEventListShellProps = {
	error: unknown;
	isError: boolean;
	loading: boolean;
	events: HomeEventListEvent[];
	/** More events match than are listed: show a link that lists the next page too. */
	hasMore: boolean;
	children: ReactNode;
};

export function HomeEventListShell({
	error,
	isError,
	loading,
	events,
	hasMore,
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

	return (
		<div className="flex flex-col gap-4">
			{children}
			{hasMore ? (
				<Button variant="outline" className="self-center" asChild>
					{/* A link, so it works before hydration and the longer list can be shared. */}
					<Link
						to="/"
						search={(prev) => ({
							...prev,
							limit: events.length + EVENT_PAGE_SIZE,
						})}
						resetScroll={false}
					>
						{events_show_more()}
					</Link>
				</Button>
			) : null}
		</div>
	);
}
