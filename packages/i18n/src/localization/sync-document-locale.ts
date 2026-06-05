import { getLocale } from "../paraglide/runtime.js";

/** Keeps `<html lang>` in sync with the active Paraglide locale on client navigations. */
export function syncDocumentLocale() {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute("lang", getLocale());
}
