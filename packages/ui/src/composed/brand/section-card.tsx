import { type ReactNode, useId } from "react";
import { cn } from "../../utils";

const STRIP_TONES = {
	cream: "bg-cream",
	green: "bg-green",
	purple: "bg-purple",
	manela: "bg-manela",
	navy: "bg-navy text-manela",
} as const;

export type SectionCardProps = {
	/** The section's name: its heading, and the name of the region. */
	heading: ReactNode;
	level: 2 | 3 | 4;
	/** One action on the right of the strip. */
	action?: ReactNode;
	tone?: keyof typeof STRIP_TONES;
	children?: ReactNode;
	className?: string;
};

/**
 * An outlined section with a header strip (like the event summary card's): the heading in
 * mono capitals on the left, one action on the right, a navy line under the strip.
 */
export function SectionCard({
	heading,
	level,
	action,
	tone = "cream",
	children,
	className,
}: SectionCardProps) {
	const headingId = useId();
	const Heading = `h${level}` as const;
	return (
		<section
			aria-labelledby={headingId}
			data-slot="card"
			className={cn(
				"border border-navy bg-card text-card-foreground",
				className,
			)}
		>
			<div
				data-slot="card-header"
				className={cn(
					"flex min-h-10 items-center justify-between gap-3 border-b border-navy px-3 py-1.5",
					STRIP_TONES[tone],
				)}
			>
				<Heading
					id={headingId}
					className="min-w-0 font-mono text-xs font-bold tracking-widest uppercase"
				>
					{heading}
				</Heading>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children}
		</section>
	);
}
