import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/**
 * Marks the document once the router has moved after the initial load
 * (`<html data-navigated>`), so entry animations play only on a full page load.
 */
export function NavigationMarker() {
	const router = useRouter();
	useEffect(
		() =>
			router.subscribe("onBeforeNavigate", ({ fromLocation, hrefChanged }) => {
				// Without a resolved location the initial load (or a redirect during it) is still running.
				if (fromLocation && hrefChanged) {
					document.documentElement.dataset.navigated = "";
				}
			}),
		[router],
	);
	return null;
}
