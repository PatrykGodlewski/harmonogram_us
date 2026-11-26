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
	home_events_title,
	home_hero_cta,
	home_hero_eyebrow,
	home_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import { Checkerboard } from "@repo/ui/composed/brand/checkerboard";
import { Eyebrow } from "@repo/ui/composed/brand/eyebrow";
import { PixelHeading } from "@repo/ui/composed/brand/pixel-heading";
import { EventErrorAlert } from "@repo/ui/composed/events/event-error-alert";
import { EventFilters } from "@repo/ui/composed/events/event-filters";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { HomeEventList } from "~/components/home-event-list";
import { HomeMarquee } from "~/components/home-marquee";

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
		<>
			<section className="overflow-hidden border-b border-navy bg-green">
				<div className="mx-auto grid max-w-6xl gap-8 px-4 pt-10 pb-6 sm:px-6 md:grid-cols-[1fr_auto] md:items-center md:py-16">
					<div className="flex min-w-0 flex-col gap-5">
						<Eyebrow>{home_hero_eyebrow()}</Eyebrow>
						<PixelHeading
							level={1}
							className="text-[clamp(2rem,9vw,4.75rem)] leading-none uppercase"
						>
							{home_title()}
						</PixelHeading>
						<p className="max-w-prose font-mono text-sm sm:text-base">
							{home_description()}
						</p>
						<Button asChild size="lg" className="self-start">
							<a href="#wydarzenia">
								{home_hero_cta()}
								<span aria-hidden>↓</span>
							</a>
						</Button>
					</div>
					<Checkerboard
						columns={10}
						rows={8}
						animated
						className="hidden h-60 w-75 text-navy md:block"
					/>
				</div>
				<Checkerboard
					columns={24}
					rows={3}
					animated
					className="block h-10 w-full text-navy md:hidden"
				/>
			</section>
			<HomeMarquee />
			<div
				id="wydarzenia"
				className="mx-auto flex w-full max-w-6xl scroll-mt-4 flex-col gap-6 px-4 py-10 sm:px-6"
			>
				<h2 className="border-b border-navy pb-3 text-3xl uppercase sm:text-4xl">
					{home_events_title()}
				</h2>
				{children}
			</div>
		</>
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
			<HomeEventList filters={filters} userId={user?.id} />
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
			className="self-center font-mono text-sm underline underline-offset-4"
		>
			{calendar_campus_subscribe()}
		</a>
	);
}
