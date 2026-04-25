import * as m from "@repo/i18n/paraglide/messages";
import { getLocale, locales, setLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "../components/button";

export function LocaleSwitcher() {
	const currentLocale = getLocale();
	const currentIndex = locales.indexOf(currentLocale);
	const nextLocale = locales[(currentIndex + 1) % locales.length];

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={() => setLocale(nextLocale)}
			className="h-7 gap-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			aria-label={m.language_label()}
			title={m.language_label()}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				className="h-3.5 w-3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			>
				<circle cx="12" cy="12" r="9" />
				<path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
			</svg>
			{currentLocale.toUpperCase()}
		</Button>
	);
}
