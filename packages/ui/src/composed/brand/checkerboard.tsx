import { cn } from "../../utils";

export type CheckerboardProps = {
	columns: number;
	rows: number;
	className?: string;
	/** Some squares flip on and off slowly (idle animation). */
	animated?: boolean;
};

/** Deterministic "random": the same squares on server and client. */
function noise(x: number, y: number): number {
	const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
	return value - Math.floor(value);
}

/**
 * Decorative pixel art: a checkerboard that dissolves into solid colour along a diagonal,
 * like the brand's grid illustrations. Draws in `currentColor`.
 */
export function Checkerboard({
	columns,
	rows,
	className,
	animated = false,
}: CheckerboardProps) {
	const cells: { x: number; y: number; flip: boolean }[] = [];
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			const along = (x + y) / (columns + rows - 2);
			const checker = (x + y) % 2 === 0;
			const filled = along > 0.62 || (along > 0.25 && checker);
			if (filled) {
				cells.push({ x, y, flip: animated && noise(x, y) > 0.86 });
			}
		}
	}
	return (
		<svg
			aria-hidden
			viewBox={`0 0 ${columns} ${rows}`}
			preserveAspectRatio="xMidYMid slice"
			shapeRendering="crispEdges"
			className={cn("fill-current", className)}
		>
			{cells.map(({ x, y, flip }) => (
				<rect
					key={`${x},${y}`}
					x={x}
					y={y}
					width={1}
					height={1}
					className={flip ? "animate-pixel-flip" : undefined}
					style={
						flip
							? { animationDelay: `${Math.round(noise(y, x) * 6000)}ms` }
							: undefined
					}
				/>
			))}
		</svg>
	);
}
