import { adminActivityQueryOptions } from "@repo/api/admin/activity";
import {
	activity_events,
	activity_month,
	activity_note,
	activity_registrations,
	activity_title,
	activity_total,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useId } from "react";

/** "listopad 2026" for "2026-11" (a calendar month, not a moment: no time zone shift). */
function monthLabel(month: string, locale: string): string {
	const [year, monthNumber] = month.split("-").map(Number);
	return new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(Date.UTC(year ?? 1970, (monthNumber ?? 1) - 1, 1));
}

/** Events and registrations per month, for administrators (F15). */
export function AdminActivity() {
	const headingId = useId();
	const { data: months } = useSuspenseQuery(adminActivityQueryOptions);
	const locale = getLocale();
	const busiest = Math.max(1, ...months.map((month) => month.registrations));
	const total = months.reduce(
		(sum, month) => ({
			events: sum.events + month.events,
			registrations: sum.registrations + month.registrations,
		}),
		{ events: 0, registrations: 0 },
	);

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2 id={headingId} className="text-lg font-semibold">
				{activity_title()}
			</h2>
			<Table aria-labelledby={headingId}>
				<TableHeader>
					<TableRow>
						<TableHead scope="col">{activity_month()}</TableHead>
						<TableHead scope="col" className="text-right">
							{activity_events()}
						</TableHead>
						<TableHead scope="col">{activity_registrations()}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{months.map((month) => (
						<TableRow key={month.month}>
							<TableHead scope="row" className="font-normal">
								{monthLabel(month.month, locale)}
							</TableHead>
							<TableCell className="text-right tabular-nums">
								{month.events}
							</TableCell>
							<TableCell>
								<div className="flex items-center gap-2">
									<span className="w-10 text-right tabular-nums">
										{month.registrations}
									</span>
									<div
										aria-hidden="true"
										className="h-2 rounded-full bg-primary"
										style={{
											width: `${(month.registrations / busiest) * 100}%`,
											maxWidth: "10rem",
										}}
									/>
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
				<TableFooter>
					<TableRow>
						<TableHead scope="row">{activity_total()}</TableHead>
						<TableCell className="text-right tabular-nums">
							{total.events}
						</TableCell>
						<TableCell className="tabular-nums">
							<span className="inline-block w-10 text-right">
								{total.registrations}
							</span>
						</TableCell>
					</TableRow>
				</TableFooter>
			</Table>
			<p className="text-sm text-muted-foreground">{activity_note()}</p>
		</section>
	);
}
