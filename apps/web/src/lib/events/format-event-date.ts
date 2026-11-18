import { getLocale } from "@repo/i18n/paraglide/runtime";
import { formatWarsawDate } from "@repo/ui/time";

export function formatEventDate(date: Date | string) {
	return formatWarsawDate(date, getLocale());
}
