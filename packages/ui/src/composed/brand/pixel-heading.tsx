import type { ComponentProps } from "react";
import { cn } from "../../utils";

export type PixelHeadingProps = ComponentProps<"h1"> & {
	level: 1 | 2 | 3;
};

/** A heading in the pixel face that uncovers in steps (stepped animation). */
export function PixelHeading({
	level,
	className,
	...props
}: PixelHeadingProps) {
	const Heading = `h${level}` as const;
	return (
		<Heading
			className={cn("animate-pixel-reveal font-pixel font-semibold", className)}
			{...props}
		/>
	);
}
