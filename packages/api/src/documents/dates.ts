/** Long dates for printed documents, in the installation time zone. */
import { env } from "@repo/env/client";

/** "1 grudnia 2026" / "1 December 2026". */
export function formatLongDate(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}

/** "1 grudnia 2026, 18:00" / "1 December 2026 at 18:00". */
export function formatLongDateTime(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}
