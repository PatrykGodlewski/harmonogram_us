import type { ReactNode } from "react";

/** Narrow, centred column for the public join and invitation pages. */
export function LandingShell({ children }: { children: ReactNode }) {
	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
			{children}
		</div>
	);
}
