import type { AttendanceMode } from "../schema/events";

/** What a draft still needs before it can be published (pure: the panel shows it too). */
export type MissingForPublish = "place" | "link";

/**
 * On-site events need a place from the list or a typed room; online ones a
 * link; hybrid ones both. Blank text doesn't count.
 */
export function missingForPublish(event: {
	attendanceMode: AttendanceMode;
	locationId: string | null;
	room: string | null;
	onlineUrl: string | null;
}): MissingForPublish[] {
	const hasPlace = event.locationId !== null || Boolean(event.room?.trim());
	const hasLink = Boolean(event.onlineUrl?.trim());
	const missing: MissingForPublish[] = [];
	if (event.attendanceMode !== "online" && !hasPlace) missing.push("place");
	if (event.attendanceMode !== "onsite" && !hasLink) missing.push("link");
	return missing;
}
