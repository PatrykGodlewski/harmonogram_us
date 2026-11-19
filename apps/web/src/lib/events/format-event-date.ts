import { getLocale } from "@repo/i18n/paraglide/runtime";
import { formatEventDate } from "@repo/ui/time";

/** The event date in the current UI locale. */
export function formatEventDateForLocale(date: Date | string) {
	return formatEventDate(date, getLocale());
}
