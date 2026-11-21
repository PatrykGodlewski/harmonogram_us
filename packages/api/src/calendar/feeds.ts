/** Server-only: calendar responses for the API routes (never import from components). */
import {
	type CalendarEntry,
	getCalendarEntry,
	listMyCalendarEntries,
	listPublicCalendarEntries,
} from "@repo/db/queries/calendar";
import {
	type ImportedEvent,
	listIndicoCalendarEntries,
} from "@repo/db/queries/indico-events";
import { env } from "@repo/env";
import {
	calendar_my_name,
	calendar_public_name,
} from "@repo/i18n/paraglide/messages";
import {
	baseLocale,
	isLocale,
	type Locale,
} from "@repo/i18n/paraglide/runtime";
import { getCurrentSession } from "../auth/user";
import { canOpenEvent } from "../events/access";
import { type IcsEvent, toIcs } from "./ics";

/** The language of the links: from `?lang=` (the page the link was on), else the base locale. */
export function calendarLocale(request: Request): Locale {
	const lang = new URL(request.url).searchParams.get("lang");
	return lang && isLocale(lang) ? lang : baseLocale;
}

function toIcsEvent(entry: CalendarEntry, locale: Locale): IcsEvent {
	return {
		uid: entry.id,
		title: entry.title,
		description: entry.description,
		start: entry.start,
		end: entry.end,
		location: entry.place,
		url: `${env.BETTER_AUTH_URL}/${locale}/events/${entry.id}`,
		cancelled: entry.cancelled,
	};
}

const DAY_MS = 86_400_000;

/** An event from the university's Indico (F16): its own uid, linking to Indico. */
export function indicoIcsEvent(event: ImportedEvent): IcsEvent {
	const place = [event.location, event.room].filter(Boolean).join(" · ");
	return {
		uid: `indico-${event.id}`,
		title: event.title,
		description: null,
		start: event.startsAt,
		// As for local events: no end means a day after the start.
		end: event.endsAt ?? new Date(event.startsAt.getTime() + DAY_MS),
		location: place || null,
		url: event.url,
		cancelled: false,
	};
}

function calendarResponse(
	body: string,
	options: { filename?: string; personal?: boolean } = {},
): Response {
	return new Response(body, {
		headers: {
			"content-type": "text/calendar; charset=utf-8",
			// Calendar apps poll feeds; a personal one must not sit in shared caches.
			"cache-control": options.personal
				? "private, max-age=300"
				: "public, max-age=300",
			...(options.filename
				? {
						"content-disposition": `attachment; filename="${options.filename}"`,
					}
				: {}),
		},
	});
}

/** All upcoming public events, for subscribing to the campus calendar. */
export async function publicCalendarResponse(
	locale: Locale,
): Promise<Response> {
	const now = new Date();
	const [entries, indico] = await Promise.all([
		listPublicCalendarEntries(now),
		listIndicoCalendarEntries(now),
	]);
	const events = [
		...entries.map((entry) => toIcsEvent(entry, locale)),
		...indico.map(indicoIcsEvent),
	].sort((a, b) => a.start.getTime() - b.start.getTime());
	return calendarResponse(toIcs(events, calendar_public_name({}, { locale })));
}

/** One event as a file, for "add to calendar". */
export async function eventCalendarResponse(
	eventId: string,
	locale: Locale,
	invite: string | undefined,
): Promise<Response> {
	const session = await getCurrentSession();
	const userId = session?.user.id ?? null;
	const entry = await getCalendarEntry(eventId, {
		signedIn: userId !== null,
		includePrivate: await canOpenEvent(eventId, userId, invite),
	});
	if (!entry) {
		return new Response("Not found", { status: 404 });
	}
	return calendarResponse(toIcs([toIcsEvent(entry, locale)], entry.title), {
		filename: "wydarzenie.ics",
		// Signed-in-only and invite-only events stay out of shared caches.
		personal: userId !== null || invite !== undefined,
	});
}

/** A person's registrations, behind the secret token in the feed URL. */
export async function myCalendarResponse(
	token: string,
	locale: Locale,
): Promise<Response> {
	const entries = await listMyCalendarEntries(token);
	if (!entries) {
		return new Response("Not found", { status: 404 });
	}
	return calendarResponse(
		toIcs(
			entries.map((entry) => toIcsEvent(entry, locale)),
			calendar_my_name({}, { locale }),
		),
		{ personal: true },
	);
}
