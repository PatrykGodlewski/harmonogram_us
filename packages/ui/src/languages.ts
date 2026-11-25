import {
	AGENDA_LANGUAGES,
	type AgendaLanguage,
} from "@repo/db/agenda-languages";

/** A language's name in the reader's language: `languageName("pl", "en")` → "Polish". */
export function languageName(code: string, locale: string): string {
	return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
}

/** The languages a programme item may be held in, named in the reader's language. */
export function agendaLanguageOptions(
	locale: string,
): { code: AgendaLanguage; label: string }[] {
	return AGENDA_LANGUAGES.map((code) => ({
		code,
		label: languageName(code, locale),
	}));
}
