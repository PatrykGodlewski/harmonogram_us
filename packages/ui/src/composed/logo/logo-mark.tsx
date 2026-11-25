import { cn } from "@repo/ui/utils";

export type LogoMarkSize = "sm" | "md";

const markSizeClasses: Record<LogoMarkSize, string> = {
	sm: "size-8",
	md: "size-10",
};

/** A pixel calendar page: two binding tabs, a frame and checkered days. */
const PIXELS = [
	".X...X.",
	"XXXXXXX",
	"X.....X",
	"X.X.X.X",
	"X..X..X",
	"X.X.X.X",
	"XXXXXXX",
];

/** Cells that flip on hover (the "days"). */
const DAYS = new Set(["3,2", "3,4", "4,3", "5,2", "5,4"]);

const CELLS = PIXELS.flatMap((row, y) =>
	[...row].flatMap((cell, x) =>
		cell === "X" ? [{ id: `${y},${x}`, x, y, day: DAYS.has(`${y},${x}`) }] : [],
	),
);

export interface LogoMarkProps {
	size?: LogoMarkSize;
	className?: string;
}

export function LogoMark({ size = "md", className }: LogoMarkProps) {
	return (
		<svg
			aria-hidden
			viewBox="0 0 7 7"
			shapeRendering="crispEdges"
			className={cn(
				"group/mark shrink-0 fill-current",
				markSizeClasses[size],
				className,
			)}
		>
			{CELLS.map(({ id, x, y, day }) => (
				<rect
					key={id}
					x={x}
					y={y}
					width={1}
					height={1}
					className={cn(
						day &&
							"transition-opacity duration-150 [transition-timing-function:steps(2)] group-hover/mark:opacity-30",
					)}
				/>
			))}
		</svg>
	);
}
