import { eventFilterOptionsQueryOptions } from "@repo/api/events/queries";
import type { EventSearch } from "@repo/api/events/schemas";
import {
	filter_when_7d,
	filter_when_today_short,
	home_marquee_label,
} from "@repo/i18n/paraglide/messages";
import { Marquee } from "@repo/ui/composed/brand/marquee";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** One link in the band: big pixel words with an arrow. */
function MarqueeLink({
	children,
	search,
}: {
	children: ReactNode;
	search: EventSearch;
}) {
	return (
		<li className="flex items-center">
			<Link
				to="/"
				search={search}
				hash="wydarzenia"
				className="px-5 py-3 font-pixel text-2xl whitespace-nowrap uppercase outline-none hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-4 focus-visible:outline-navy sm:text-4xl"
			>
				{children}
				<span aria-hidden className="ml-4">
					↗
				</span>
			</Link>
		</li>
	);
}

/** A purple band of shortcuts: today, this week and each event type filter the list. */
export function HomeMarquee() {
	const { data } = useQuery(eventFilterOptionsQueryOptions);
	return (
		<Marquee label={home_marquee_label()} className="bg-purple">
			<MarqueeLink search={{ whenFilter: "today" }}>
				{filter_when_today_short()}
			</MarqueeLink>
			<MarqueeLink search={{ whenFilter: "7d" }}>
				{filter_when_7d()}
			</MarqueeLink>
			{data?.types.map((type) => (
				<MarqueeLink key={type.id} search={{ eventTypeFilter: type.slug }}>
					{type.label}
				</MarqueeLink>
			))}
		</Marquee>
	);
}
