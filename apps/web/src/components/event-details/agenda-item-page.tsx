import {
	agenda_item_audience,
	agenda_item_basics,
	agenda_item_category,
	agenda_item_details,
	agenda_item_faculty,
	agenda_item_languages,
	agenda_item_less,
	agenda_item_more,
	agenda_item_place,
	agenda_item_seats,
	agenda_item_session,
	agenda_item_topic,
	agenda_item_updated,
	agenda_item_when,
	agenda_item_where,
	agenda_speakers,
	event_details_full,
	event_details_overlaps,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { findOverlaps } from "@repo/ui/agenda";
import { Checkerboard } from "@repo/ui/composed/brand/checkerboard";
import { PixelHeading } from "@repo/ui/composed/brand/pixel-heading";
import { languageName } from "@repo/ui/languages";
import { formatEventDayLong, formatEventTime } from "@repo/ui/time";
import { useSearch } from "@tanstack/react-router";
import { type ReactNode, useId, useState } from "react";
import { isEventClosed } from "~/lib/event-details/is-event-closed";
import { isItemFull, itemSeatCount } from "~/lib/event-details/item-seats";
import type {
	AgendaItemData,
	EventDetailsData,
	EventDetailsRegistrations,
} from "~/lib/event-details/types";
import { AgendaItemAction, AgendaItemMaterials } from "./agenda-item-row";

type AgendaItemPageProps = {
	event: EventDetailsData;
	item: AgendaItemData;
	user: { id: string; email: string } | null;
	interactive: boolean;
	registrations: EventDetailsRegistrations;
	/** When the seat counts were last fetched (they refresh in the background). */
	updatedAt: number;
};

/** Everything about one programme item (F18), laid out like a festival programme entry. */
export function AgendaItemPage({
	event,
	item,
	user,
	interactive,
	registrations,
	updatedAt,
}: AgendaItemPageProps) {
	const locale = getLocale();
	const invite = useSearch({
		strict: false,
		select: (search) => search.invite,
	});
	const session = event.sessions.find((entry) => entry.id === item.sessionId);
	const place = item.locationLabel ?? session?.locationLabel ?? null;
	const overlapsWith = findOverlaps(
		event.agenda,
		registrations.registeredItemIds,
	).get(item.id);
	const basics = [
		[agenda_item_category(), item.typeLabel],
		[agenda_item_topic(), item.topic],
		[
			agenda_item_languages(),
			item.languages.map((code) => languageName(code, locale)).join(", "),
		],
		[agenda_item_faculty(), item.facultyLabel],
		[agenda_item_audience(), item.audience],
	].filter((row): row is [string, string] => Boolean(row[1]));

	return (
		<article className="flex flex-col gap-6">
			<header className="border border-navy bg-green">
				<p className="flex flex-wrap gap-x-3 border-b border-navy px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase">
					<span>{item.typeLabel ?? event.typeLabel}</span>
					<span className="truncate">{event.title}</span>
				</p>
				<PixelHeading
					level={1}
					className="p-5 text-[clamp(1.75rem,6vw,3rem)] leading-tight sm:p-8"
				>
					{item.title}
				</PixelHeading>
				{item.hasImage && item.imageAlt ? (
					<img
						src={`/api/agenda-items/${item.id}/image${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`}
						alt={item.imageAlt}
						className="aspect-video w-full border-t border-navy bg-manela object-cover"
					/>
				) : (
					<Checkerboard
						columns={24}
						rows={3}
						className="border-t border-navy text-navy"
					/>
				)}
			</header>

			{basics.length > 0 ? (
				<Panel title={agenda_item_basics()}>
					<dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
						{basics.map(([label, value]) => (
							<Row key={label} label={label}>
								{value}
							</Row>
						))}
					</dl>
				</Panel>
			) : null}

			<Panel title={agenda_item_where()}>
				<dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
					<Row label={agenda_item_when()}>
						<span className="first-letter:uppercase">
							{formatEventDayLong(item.startsAt, locale)}
						</span>
						, {formatEventTime(item.startsAt, locale)}–
						{formatEventTime(item.endsAt, locale)}
					</Row>
					{place ? <Row label={agenda_item_place()}>{place}</Row> : null}
					{session ? (
						<Row label={agenda_item_session()}>{session.title}</Row>
					) : null}
					{item.requiresRegistration && item.maxSeats !== null ? (
						<Row label={agenda_item_seats()}>
							<ItemSeats
								remaining={item.seatsRemaining ?? 0}
								max={item.maxSeats}
								updatedAt={updatedAt}
							/>
						</Row>
					) : null}
				</dl>
				{overlapsWith?.length ? (
					<p className="text-sm font-bold">
						{event_details_overlaps({ titles: overlapsWith.join(", ") })}
					</p>
				) : null}
				<div>
					<AgendaItemAction
						item={item}
						eventId={event.id}
						user={user}
						interactive={interactive}
						closed={
							isEventClosed(event) ||
							new Date(item.endsAt).getTime() <= Date.now()
						}
						isFull={isItemFull(itemSeatCount(item))}
						registrations={registrations}
					/>
				</div>
			</Panel>

			{item.description ? (
				<Panel title={agenda_item_details()}>
					<p className="max-w-prose whitespace-pre-line">{item.description}</p>
				</Panel>
			) : null}

			{item.speakers.length > 0 ? (
				<Panel title={agenda_speakers()}>
					<ul className="flex flex-col gap-5">
						{item.speakers.map((speaker, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a static list that may repeat a name
							<li key={index} className="flex gap-3">
								<Monogram name={speaker.name} />
								<div className="flex min-w-0 flex-col gap-1">
									<p className="font-bold">{speaker.name}</p>
									{speaker.affiliation ? (
										<p className="text-sm">{speaker.affiliation}</p>
									) : null}
									{speaker.unit ? (
										<p className="text-sm text-muted-foreground">
											{speaker.unit}
										</p>
									) : null}
									{speaker.bio ? <Bio text={speaker.bio} /> : null}
								</div>
							</li>
						))}
					</ul>
				</Panel>
			) : null}

			<AgendaItemMaterials
				item={item}
				files={event.files.filter((file) => file.agendaItemId === item.id)}
			/>
		</article>
	);
}

function ItemSeats({
	remaining,
	max,
	updatedAt,
}: {
	remaining: number;
	max: number;
	updatedAt: number;
}) {
	const locale = getLocale();
	return (
		<span className="flex flex-wrap items-baseline gap-x-3">
			<span
				className="font-mono font-bold tabular-nums"
				aria-live="polite"
				aria-atomic="true"
			>
				{Math.max(remaining, 0)} / {max}
				{remaining <= 0 ? ` · ${event_details_full()}` : ""}
			</span>
			<span className="font-mono text-xs text-muted-foreground">
				{agenda_item_updated({
					time: formatEventTime(new Date(updatedAt), locale),
				})}
			</span>
		</span>
	);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
	const headingId = useId();
	return (
		<section
			aria-labelledby={headingId}
			className="flex flex-col gap-3 border border-navy bg-white p-4 sm:p-6"
		>
			<h2 id={headingId} className="text-xl">
				{title}
			</h2>
			{children}
		</section>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<>
			<dt className="font-mono text-xs font-bold tracking-widest uppercase sm:pt-0.5">
				{label}
			</dt>
			<dd className="mb-2 sm:mb-0">{children}</dd>
		</>
	);
}

/** Initials in a square, standing in for a photo. */
function Monogram({ name }: { name: string }) {
	const initials = name
		.split(/\s+/)
		.filter((word) => /^\p{Lu}/u.test(word))
		.slice(-2)
		.map((word) => word[0])
		.join("");
	return (
		<span
			aria-hidden
			className="flex size-12 shrink-0 items-center justify-center border border-navy bg-purple font-pixel text-lg"
		>
			{initials}
		</span>
	);
}

/** Long bios start folded to four lines. */
const BIO_FOLD_CHARS = 320;

function Bio({ text }: { text: string }) {
	const [open, setOpen] = useState(false);
	const id = useId();
	const long = text.length > BIO_FOLD_CHARS;
	return (
		<div className="flex flex-col items-start gap-1">
			<p
				id={id}
				className={`max-w-prose text-sm whitespace-pre-line ${long && !open ? "line-clamp-4" : ""}`}
			>
				{text}
			</p>
			{long ? (
				<button
					type="button"
					aria-expanded={open}
					aria-controls={id}
					className="font-mono text-sm font-bold underline underline-offset-4"
					onClick={() => setOpen((current) => !current)}
				>
					{open ? agenda_item_less() : agenda_item_more()}
				</button>
			) : null}
		</div>
	);
}
