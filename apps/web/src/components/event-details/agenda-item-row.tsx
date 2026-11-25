import {
	agenda_materials,
	agenda_speakers,
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
import { Link, useSearch } from "@tanstack/react-router";
import { isItemFull } from "~/lib/event-details/item-seats";
import type {
	AgendaItemData,
	EventDetailsData,
	EventDetailsRegistrations,
	ItemSeatCount,
} from "~/lib/event-details/types";
import { FileLink } from "./file-link";
import { LoginToRegisterButton } from "./login-to-register-button";

type AgendaItemRowProps = {
	item: AgendaItemData & { parallel: boolean };
	/** The speakers' files for this item (F19). */
	files: EventDetailsData["files"];
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
	files,
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
	const invite = useSearch({
		strict: false,
		select: (search) => search.invite,
	});
	const isFull = isItemFull(seatCount);

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
				<p className="font-medium">
					<Link
						to="/events/$eventId/program/$itemId"
						params={{ eventId, itemId: item.id }}
						search={{ invite }}
						className="underline-offset-4 hover:underline"
					>
						{item.title}
					</Link>
				</p>
				{item.speakers.length > 0 ? (
					<ul aria-label={agenda_speakers()} className="text-sm">
						{item.speakers.map((speaker, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a static list that may repeat a name
							<li key={index}>
								<span className="font-medium">{speaker.name}</span>
								{speaker.affiliation ? (
									<span className="text-muted-foreground">
										{" · "}
										{speaker.affiliation}
									</span>
								) : null}
							</li>
						))}
					</ul>
				) : null}
				{item.description ? (
					<p className="line-clamp-2 text-sm text-muted-foreground">
						{item.description}
					</p>
				) : null}
				<AgendaItemMaterials item={item} files={files} />
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

export function AgendaItemAction({
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

type AgendaItemMaterialsProps = {
	item: Pick<AgendaItemData, "materials">;
	files: EventDetailsData["files"];
};

/** The item's links and the speakers' files (F19). */
export function AgendaItemMaterials({ item, files }: AgendaItemMaterialsProps) {
	if (item.materials.length === 0 && files.length === 0) {
		return null;
	}
	return (
		<ul
			aria-label={agenda_materials()}
			className="flex flex-wrap gap-x-3 gap-y-1 text-sm"
		>
			{item.materials.map((material, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: a static list that may repeat a link
				<li key={index}>
					<a
						href={material.url}
						target="_blank"
						rel="noopener noreferrer"
						className="underline underline-offset-2"
					>
						{material.label}
					</a>
				</li>
			))}
			{files.map((file) => (
				<li key={file.id}>
					<FileLink file={file} />
				</li>
			))}
		</ul>
	);
}
