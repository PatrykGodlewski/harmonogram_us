import * as m from "@repo/i18n/paraglide/messages";
import { getLocale, locales, setLocale } from "@repo/i18n/paraglide/runtime";

export function LocaleSwitcher() {
	const currentLocale = getLocale();

	return (
		<fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0 text-sm text-foreground">
			<legend className="sr-only">{m.language_label()}</legend>
			<span className="text-muted-foreground">
				{m.current_locale({ locale: currentLocale })}
			</span>
			<div className="flex gap-1">
				{locales.map((locale) => (
					<button
						key={locale}
						type="button"
						onClick={() => setLocale(locale)}
						aria-pressed={locale === currentLocale}
						className={
							locale === currentLocale
								? "cursor-pointer rounded-full border border-border bg-primary px-3 py-1.5 text-xs font-semibold tracking-wide text-primary-foreground"
								: "cursor-pointer rounded-full border border-border bg-transparent px-3 py-1.5 text-xs font-medium tracking-wide text-foreground hover:bg-accent"
						}
					>
						{locale.toUpperCase()}
					</button>
				))}
			</div>
		</fieldset>
	);
}
