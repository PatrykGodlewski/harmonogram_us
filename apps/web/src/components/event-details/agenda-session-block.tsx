import type { EventDetails } from "@repo/api/events/queries";
import {
	event_details_hide_items,
	event_details_show_items,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Fold } from "@repo/ui/composed/brand/fold";
import { sessionColorClasses } from "@repo/ui/session-colors";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { type ReactNode, useId, useState } from "react";

type AgendaSessionBlockProps = {
	session: EventDetails["sessions"][number];
	itemCount: number;
	/** The session's items, already rendered as list items. */
	children: ReactNode;
	/** h4 under day headings, h3 otherwise. */
	headingLevel: 3 | 4;
	/** Long programmes start with sessions folded to their header. */
	defaultFolded: boolean;
	locale: string;
};

/** A session in the public programme (F33): theme, time and place, then its items. */
export function AgendaSessionBlock({
	session,
	itemCount,
	children,
	headingLevel,
	defaultFolded,
	locale,
}: AgendaSessionBlockProps) {
	const [folded, setFolded] = useState(defaultFolded);
	const listId = useId();
	const list = <ol className="divide-y">{children}</ol>;
	const headingId = `session-${session.id}`;
	const Heading = headingLevel === 3 ? "h3" : "h4";

	return (
		<li className="py-3">
			<section aria-labelledby={headingId} className="flex gap-3">
				<span
					aria-hidden
					className={cn(
						"w-1.5 shrink-0",
						sessionColorClasses[session.color].bar,
					)}
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<p className="text-sm text-muted-foreground tabular-nums">
						{formatEventTime(session.startsAt, locale)}–
						{formatEventTime(session.endsAt, locale)}
						{session.locationLabel ? ` · ${session.locationLabel}` : ""}
					</p>
					<Heading id={headingId} className="font-semibold break-words">
						{session.title}
					</Heading>
					{session.description ? (
						<p className="text-sm text-muted-foreground break-words">
							{session.description}
						</p>
					) : null}
					{itemCount > 0 && defaultFolded ? (
						<Button
							type="button"
							variant="link"
							className="h-auto self-start px-0"
							aria-expanded={!folded}
							aria-controls={listId}
							onClick={() => setFolded((value) => !value)}
						>
							{folded
								? event_details_show_items({ count: itemCount })
								: event_details_hide_items()}
						</Button>
					) : null}
					{itemCount === 0 ? null : defaultFolded ? (
						<Fold id={listId} open={!folded}>
							{list}
						</Fold>
					) : (
						list
					)}
				</div>
			</section>
		</li>
	);
}
