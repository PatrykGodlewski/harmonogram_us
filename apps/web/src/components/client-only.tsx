import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

function subscribe() {
	return () => {};
}

/** Client-only boundary for hooks that cannot run during SSR (e.g. TanStack DB live queries). */
export function ClientOnly({
	children,
	fallback,
}: {
	children: ReactNode;
	fallback: ReactNode;
}) {
	const isClient = useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);

	return isClient ? children : fallback;
}
