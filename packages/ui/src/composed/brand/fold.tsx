import type { ReactNode } from "react";
import { cn } from "../../utils";

export type FoldProps = {
	/** Target of the caller's toggle button (`aria-controls`). */
	id: string;
	/** Owned by the caller, whose button carries `aria-expanded`. */
	open: boolean;
	children?: ReactNode;
	className?: string;
};

/**
 * Content that opens and closes with a short ease-out height animation, for any length
 * (the grid row grows from 0fr to 1fr). Closed content is inert: out of the tab order and
 * the accessibility tree. Reduced motion makes the change instant.
 */
export function Fold({ id, open, children, className }: FoldProps) {
	return (
		<div
			id={id}
			data-slot="fold"
			data-state={open ? "open" : "closed"}
			inert={!open}
			className={cn(
				// Invisible once closed (visibility flips after the height has shrunk), so the
				// content is also gone for anything that asks what is visible.
				"grid transition-[grid-template-rows,visibility] duration-200 ease-out",
				open ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
				className,
			)}
		>
			<div className="min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}
