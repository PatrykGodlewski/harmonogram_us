import {
	event_details_closed,
	event_details_full,
	event_details_no_registration,
	event_details_overlaps,
	event_details_places_left,
	events_register,
	events_registered,
	events_unregister,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import type {
	AgendaItemData,
	EventDetailsRegistrations,
	ItemSeatCount,
} from "~/lib/event-details/types";
import { LoginToRegisterButton } from "./login-to-register-button";

type AgendaItemRowProps = {
	item: AgendaItemData & { parallel: boolean };
	/** "li" in the agenda list, "div" in the calendar's dialog. */
	as?: "li" | "div";
	eventId: string;
	user: { id: string; email: string } | null;
	interactive: boolean;
	eventClosed: boolean;
	seatCount: ItemSeatCount;
	overlapsWith: string[] | undefined;
	registrations: EventDetailsRegistrations;
};

export function AgendaItemRow({
	item,
	as: Tag = "li",
	eventId,
	user,
	interactive,
	eventClosed,
	seatCount,
	overlapsWith,
	registrations,
}: AgendaItemRowProps) {
	const locale = getLocale();
	const isFull =
		seatCount.seatsRemaining !== null && seatCount.seatsRemaining <= 0;

	return (
		<Tag
			className={cn(
				"flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between",
				item.parallel && "ml-3 border-l border-dashed pl-4",
			)}
		>
			<div className="flex flex-col gap-1">
				<p className="text-sm text-muted-foreground tabular-nums">
					{formatEventTime(item.startsAt, locale)}–
					{formatEventTime(item.endsAt, locale)}
					{item.locationLabel ? ` · ${item.locationLabel}` : ""}
				</p>
				<p className="font-medium">{item.title}</p>
				{item.description ? (
					<p className="text-sm text-muted-foreground">{item.description}</p>
				) : null}
				{item.requiresRegistration && seatCount.maxSeats !== null ? (
					<p
						className="text-sm tabular-nums"
						aria-live="polite"
						aria-atomic="true"
					>
						{isFull
							? event_details_full()
							: event_details_places_left({
									remaining: seatCount.seatsRemaining ?? 0,
									max: seatCount.maxSeats,
								})}
					</p>
				) : null}
				{overlapsWith?.length ? (
					<p className="text-sm text-amber-700 dark:text-amber-400">
						{event_details_overlaps({ titles: overlapsWith.join(", ") })}
					</p>
				) : null}
			</div>
			<div className="sm:shrink-0">
				<AgendaItemAction
					item={item}
					eventId={eventId}
					user={user}
					interactive={interactive}
					closed={eventClosed || new Date(item.endsAt).getTime() <= Date.now()}
					isFull={isFull}
					registrations={registrations}
				/>
			</div>
		</Tag>
	);
}

type AgendaItemActionProps = {
	item: AgendaItemData;
	eventId: string;
	user: { id: string; email: string } | null;
	interactive: boolean;
	closed: boolean;
	isFull: boolean;
	registrations: EventDetailsRegistrations;
};

function AgendaItemAction({
	item,
	eventId,
	user,
	interactive,
	closed,
	isFull,
	registrations,
}: AgendaItemActionProps) {
	if (!item.requiresRegistration) {
		return (
			<p className="text-sm text-muted-foreground">
				{event_details_no_registration()}
			</p>
		);
	}

	const busy = !interactive || registrations.isBusy;
	const ref = { id: item.id, title: item.title };

	if (user && registrations.registeredItemIds.has(item.id) && closed) {
		return <Badge>{events_registered()} ✓</Badge>;
	}

	if (user && registrations.registeredItemIds.has(item.id)) {
		return (
			<div className="flex items-center gap-2">
				<Badge>{events_registered()} ✓</Badge>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() => registrations.unregisterItem(ref)}
				>
					{events_unregister()}
				</Button>
			</div>
		);
	}

	if (closed) {
		return (
			<p className="text-sm text-muted-foreground">{event_details_closed()}</p>
		);
	}

	if (!user) {
		return <LoginToRegisterButton eventId={eventId} />;
	}

	return (
		<Button
			size="sm"
			className="w-full sm:w-auto"
			disabled={busy || isFull}
			onClick={() => registrations.registerItem(ref)}
		>
			{isFull ? event_details_full() : events_register()}
		</Button>
	);
}
