/**
 * Absolute URL for a shape proxy path.
 *
 * The Electric client builds request URLs with `new URL(url)` (no base), so a
 * relative path throws "Invalid URL" in the browser and sync silently never
 * starts. Electric's docs resolve proxy paths against the page origin, as done
 * here. Only a fixed, same-origin path is resolved: no user input is involved.
 * On the server (SSR) collections never sync, so the path is returned as is.
 */
export function shapeUrl(path: string): string {
	if (typeof window === "undefined") {
		return path;
	}
	return new URL(path, window.location.origin).toString();
}
