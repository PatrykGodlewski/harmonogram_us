/** Server-only: the public read API for other university sites (F24). */
import {
	listUpcomingPublicEvents,
	type PublicEvent,
} from "@repo/db/queries/public-events";
import { env } from "@repo/env";
import { baseLocale, type Locale } from "@repo/i18n/paraglide/runtime";
import { z } from "zod";

const querySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	faculty: z.string().min(1).max(100).optional(),
	type: z.string().min(1).max(100).optional(),
	lang: z.enum(["pl", "en"]).optional(),
});

/** The event page on this site, in the asked language. */
export function publicEventUrl(id: string, locale: Locale): string {
	return `${env.BETTER_AUTH_URL}/${locale}/events/${encodeURIComponent(id)}`;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			// Read-only public data, no cookies: any site may fetch it.
			"access-control-allow-origin": "*",
			"cache-control": status === 200 ? "public, max-age=60" : "no-store",
		},
	});
}

function toJson(event: PublicEvent, locale: Locale) {
	return {
		id: event.id,
		title: event.title,
		startsAt: event.startsAt.toISOString(),
		endsAt: event.endsAt.toISOString(),
		place: event.place,
		attendanceMode: event.attendanceMode,
		faculty: event.faculty,
		type: event.type,
		seatsRemaining: event.seatsRemaining,
		url: publicEventUrl(event.id, locale),
	};
}

export type PublicEventsDeps = { list: typeof listUpcomingPublicEvents };

/** `GET /api/v1/events`: upcoming public events as JSON; 400 for bad parameters. */
export async function publicEventsResponse(
	request: Request,
	deps: PublicEventsDeps = { list: listUpcomingPublicEvents },
): Promise<Response> {
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const parsed = querySchema.safeParse(params);
	if (!parsed.success) {
		return json(
			{ error: parsed.error.issues.map((issue) => issue.path.join(".")) },
			400,
		);
	}
	const { limit, faculty, type, lang } = parsed.data;
	const events = await deps.list(new Date(), {
		limit,
		...(faculty ? { facultyId: faculty } : {}),
		...(type ? { typeId: type } : {}),
	});
	const locale = lang ?? baseLocale;
	return json({ events: events.map((event) => toJson(event, locale)) });
}
