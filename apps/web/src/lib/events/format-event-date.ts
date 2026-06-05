import { getLocale } from "@repo/i18n/paraglide/runtime";

export function formatEventDate(date: Date | string) {
	return new Date(date).toLocaleDateString(getLocale(), {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
