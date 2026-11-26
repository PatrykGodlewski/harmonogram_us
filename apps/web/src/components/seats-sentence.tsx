import { NumberTicker } from "@repo/ui/composed/brand/number-ticker";

type SeatsMessage = (inputs: { remaining: string; max: number }) => string;

// A character no message contains: marks where the count goes in the translated sentence.
const COUNT_SLOT = "\u0000";

/** A seat sentence from the message files, its remaining count a ticker. */
export function SeatsSentence({
	message,
	remaining,
	max,
}: {
	message: SeatsMessage;
	remaining: number;
	max: number;
}) {
	const [before, after] = message({ remaining: COUNT_SLOT, max }).split(
		COUNT_SLOT,
	);
	return (
		<>
			{before}
			<NumberTicker value={remaining} />
			{after}
		</>
	);
}
