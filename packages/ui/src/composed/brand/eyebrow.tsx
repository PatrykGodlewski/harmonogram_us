import type { ReactNode } from "react";
import { cn } from "../../utils";

/** A small mono label above a heading: "— ZAPISZ SIĘ". */
export function Eyebrow({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<p
			className={cn(
				"font-mono text-xs font-bold tracking-widest uppercase",
				className,
			)}
		>
			<span aria-hidden>— </span>
			{children}
		</p>
	);
}
