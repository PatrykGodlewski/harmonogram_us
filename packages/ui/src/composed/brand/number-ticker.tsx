import { useState } from "react";
import { cn } from "../../utils";

export type NumberTickerProps = {
	value: number;
	className?: string;
};

/**
 * A count in tabular digits that steps into place when its value changes after the first
 * paint (stepped animation). The element holds only the current number, so assistive
 * technology never meets an intermediate or stale value; the caller supplies the words.
 * Refetches with the same value do not move it; reduced motion switches the motion off in CSS.
 */
export function NumberTicker({ value, className }: NumberTickerProps) {
	const [shown, setShown] = useState(value);
	const [changed, setChanged] = useState(false);
	if (value !== shown) {
		setShown(value);
		setChanged(true);
	}
	return (
		<span
			// A new key restarts the animation on every change.
			key={changed ? value : undefined}
			data-slot="number-ticker"
			className={cn(
				"inline-block tabular-nums",
				changed && "animate-number-tick",
				className,
			)}
		>
			{value}
		</span>
	);
}
