import { marquee_pause } from "@repo/i18n/paraglide/messages";
import { PauseIcon, PlayIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../../utils";

export type MarqueeProps = {
	/** Names the band for screen readers (it is a navigation landmark). */
	label: string;
	children: ReactNode;
	className?: string;
};

/**
 * A band that scrolls its content in a loop. The content is drawn twice for a seamless
 * loop; the copy is inert and hidden from assistive technology. A button pauses it
 * (WCAG 2.2.2), as do hover and keyboard focus; with reduced motion it doesn't move and
 * scrolls by hand instead.
 */
export function Marquee({ label, children, className }: MarqueeProps) {
	const [paused, setPaused] = useState(false);
	return (
		<nav
			aria-label={label}
			className={cn("flex items-stretch border-y border-navy", className)}
		>
			<div
				className={cn(
					"group min-w-0 flex-1 overflow-x-auto motion-safe:overflow-hidden",
					paused && "marquee-paused",
				)}
			>
				<div className="flex w-max animate-marquee">
					<ul className="flex shrink-0 items-center">{children}</ul>
					<ul aria-hidden inert className="flex shrink-0 items-center">
						{children}
					</ul>
				</div>
			</div>
			<button
				type="button"
				onClick={() => setPaused((value) => !value)}
				aria-pressed={paused}
				aria-label={marquee_pause()}
				className="grid w-11 shrink-0 place-items-center border-l border-navy bg-navy text-manela outline-none hover:bg-slate focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-4 focus-visible:outline-green motion-reduce:hidden"
			>
				{paused ? (
					<PlayIcon aria-hidden className="size-4" />
				) : (
					<PauseIcon aria-hidden className="size-4" />
				)}
			</button>
		</nav>
	);
}
