const MB = 1024 * 1024;

/** "2 kB", "1,5 MB": enough to tell a slide deck from a recording, in the reader's language. */
export function formatFileSize(bytes: number, locale: string): string {
	const megabytes = bytes >= MB;
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: megabytes ? "megabyte" : "kilobyte",
		maximumFractionDigits: megabytes ? 1 : 0,
	}).format(megabytes ? bytes / MB : Math.max(1, Math.round(bytes / 1024)));
}
