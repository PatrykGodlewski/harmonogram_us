import type { EventRegistrant } from "@repo/api/admin/queries";
import {
	stats_absent,
	stats_absent_after_end,
	stats_absent_share,
	stats_pending,
	stats_present,
	stats_registered,
	stats_title,
	stats_waitlisted,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { registrantStats } from "@repo/ui/registrant-stats";
import { useId } from "react";

/** The event's numbers (F15): registered, present, no-shows once it has ended. */
export function EventStatsCard({
	registrants,
	ended,
}: {
	registrants: EventRegistrant[];
	ended: boolean;
}) {
	const headingId = useId();
	const stats = registrantStats(registrants, ended);
	const percent = new Intl.NumberFormat(getLocale(), {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const rows: [string, number][] = [
		[stats_registered(), stats.registered],
		[stats_present(), stats.present],
		...(stats.absent === null
			? []
			: ([[stats_absent(), stats.absent]] as [string, number][])),
		[stats_waitlisted(), stats.waitlisted],
		[stats_pending(), stats.pending],
	];

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2 id={headingId} className="text-lg font-semibold">
				{stats_title()}
			</h2>
			<dl className="grid grid-cols-2 border-t border-l border-navy bg-white sm:grid-cols-3">
				{rows.map(([label, value]) => (
					<div key={label} className="border-r border-b border-navy p-3">
						<dt className="font-mono text-xs font-bold tracking-wider uppercase">
							{label}
						</dt>
						<dd className="font-pixel text-3xl tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
			<p className="text-sm text-muted-foreground">
				{stats.absentShare === null
					? ended
						? null
						: stats_absent_after_end()
					: stats_absent_share({ share: percent.format(stats.absentShare) })}
			</p>
		</section>
	);
}
