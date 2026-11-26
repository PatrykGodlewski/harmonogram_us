/** Server-only: the Teams meeting of one event (F23). */
import {
	getEventForMeeting,
	setOnlineUrlIfEmpty,
} from "@repo/db/queries/events";
import { appError } from "../errors";
import { createTeamsMeeting, type TeamsConfig } from "./graph";

/**
 * The event's meeting link, creating a Teams meeting only when it has none.
 * An existing link (manual or Teams) is returned untouched and no meeting is
 * created; the conditional update covers two clicks racing past the check.
 */
export async function ensureTeamsMeeting(
	eventId: string,
	config: TeamsConfig,
	create: typeof createTeamsMeeting = createTeamsMeeting,
): Promise<string> {
	const event = await getEventForMeeting(eventId);
	if (!event) {
		throw appError("EVENT_NOT_FOUND");
	}
	if (event.attendanceMode === "onsite") {
		throw appError("TEAMS_NOT_ONLINE");
	}
	if (event.status === "cancelled") {
		throw appError("EVENT_CANCELLED");
	}
	if (event.end <= new Date()) {
		throw appError("EVENT_ENDED");
	}
	if (event.onlineUrl?.trim()) {
		return event.onlineUrl;
	}
	let joinUrl: string;
	try {
		joinUrl = await create(config, {
			subject: event.title,
			start: event.start,
			end: event.end,
		});
	} catch (error) {
		console.error(`[teams] meeting for event ${eventId} failed:`, error);
		throw appError("TEAMS_FAILED");
	}
	const onlineUrl = await setOnlineUrlIfEmpty(eventId, joinUrl);
	if (!onlineUrl) {
		throw appError("EVENT_NOT_FOUND");
	}
	return onlineUrl;
}
