/**
 * Languages a programme item may be held in (ISO 639-1), in the order the panel offers
 * them. Dependency-free, so the browser can import it; names come from `Intl.DisplayNames`.
 */
export const AGENDA_LANGUAGES = ["pl", "en", "de", "uk", "fr", "es"] as const;
export type AgendaLanguage = (typeof AGENDA_LANGUAGES)[number];
