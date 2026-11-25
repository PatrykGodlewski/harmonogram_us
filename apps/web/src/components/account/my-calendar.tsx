import { myCalendarUrlQueryOptions } from "@repo/api/calendar/my-calendar-url";
import {
	calendar_my_body,
	calendar_my_copied,
	calendar_my_copy,
	calendar_my_open,
	calendar_my_private,
	calendar_my_title,
	calendar_my_url,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";
import { toast } from "sonner";

/** The personal calendar feed: copy it, or open it straight in a calendar app. */
export function MyCalendar() {
	const headingId = useId();
	const { data: feed } = useQuery(myCalendarUrlQueryOptions);
	if (!feed) {
		return null;
	}
	// Links inside the feed open in the language of this page.
	const url = `${feed}?lang=${getLocale()}`;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(url);
		toast.success(calendar_my_copied());
	};

	return (
		<section
			aria-labelledby={headingId}
			className="border border-navy bg-white p-4"
		>
			<h2 id={headingId} className="mb-2 text-lg font-semibold">
				{calendar_my_title()}
			</h2>
			<p className="mb-3 text-sm text-muted-foreground">{calendar_my_body()}</p>
			<Input
				readOnly
				aria-label={calendar_my_url()}
				value={url}
				onFocus={(event) => event.currentTarget.select()}
			/>
			<p className="mt-1 text-xs text-muted-foreground">
				{calendar_my_private()}
			</p>
			<div className="mt-3 flex flex-col gap-2 sm:flex-row">
				<Button variant="outline" onClick={() => void handleCopy()}>
					{calendar_my_copy()}
				</Button>
				<Button variant="outline" asChild>
					<a href={url.replace(/^https?:/, "webcal:")}>{calendar_my_open()}</a>
				</Button>
			</div>
		</section>
	);
}
