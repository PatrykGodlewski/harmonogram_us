/** One event in a calendar file. */
export type IcsEvent = {
	uid: string;
	title: string;
	description: string | null;
	start: Date;
	end: Date;
	location: string | null;
	url: string;
	cancelled: boolean;
};

/** RFC 5545 text: backslash, comma, semicolon and new lines are escaped. */
function escapeText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

/** `20261201T090000Z` */
function utc(date: Date): string {
	return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

const encoder = new TextEncoder();

/** RFC 5545 folding: lines over 75 octets continue on the next line after a space. */
function fold(line: string): string {
	const parts: string[] = [];
	let current = "";
	let size = 0;
	for (const char of line) {
		const charSize = encoder.encode(char).length;
		// The first line holds 75 octets; continuation lines start with a space, so 74.
		const limit = parts.length === 0 ? 75 : 74;
		if (size + charSize > limit) {
			parts.push(current);
			current = "";
			size = 0;
		}
		current += char;
		size += charSize;
	}
	parts.push(current);
	return parts.join("\r\n ");
}

/** A calendar file (iCalendar) with the given events; times are in UTC. */
export function toIcs(events: IcsEvent[], calendarName: string): string {
	const now = utc(new Date());
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Harmonogram//Wydarzenia//PL",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		`X-WR-CALNAME:${escapeText(calendarName)}`,
	];
	for (const event of events) {
		lines.push(
			"BEGIN:VEVENT",
			`UID:${event.uid}@harmonogram`,
			`DTSTAMP:${now}`,
			`DTSTART:${utc(event.start)}`,
			`DTEND:${utc(event.end)}`,
			`SUMMARY:${escapeText(event.title)}`,
			...(event.description
				? [`DESCRIPTION:${escapeText(event.description)}`]
				: []),
			...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
			`URL:${event.url}`,
			`STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
			"END:VEVENT",
		);
	}
	lines.push("END:VCALENDAR");
	return `${lines.map(fold).join("\r\n")}\r\n`;
}
