import { useEffect } from "react";

/**
 * Marks the document once React has hydrated (`<html data-hydrated="true">`), so
 * browser tests interact only after inputs are controlled by React.
 */
export function HydrationMarker() {
	useEffect(() => {
		document.documentElement.dataset.hydrated = "true";
	}, []);
	return null;
}
