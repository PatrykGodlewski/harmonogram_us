/** Width of `text` at font `size`, in the same unit as the space it must fit. */
export type MeasureText = (text: string, size: number) => number;

/** Splits text into lines no wider than `maxWidth`; words that are too long are broken. */
function wrap(
	text: string,
	measure: MeasureText,
	size: number,
	maxWidth: number,
): string[] {
	const lines: string[] = [];
	let line = "";
	const push = (word: string) => {
		const candidate = line ? `${line} ${word}` : word;
		if (measure(candidate, size) <= maxWidth) {
			line = candidate;
			return;
		}
		if (line) {
			lines.push(line);
		}
		line = "";
		// A word wider than the line goes letter by letter.
		let part = "";
		for (const char of word) {
			if (part && measure(part + char, size) > maxWidth) {
				lines.push(part);
				part = "";
			}
			part += char;
		}
		line = part;
	};
	for (const word of text.split(/\s+/).filter(Boolean)) {
		push(word);
	}
	return line ? [...lines, line] : lines;
}

/**
 * The largest of `sizes` (largest first) at which `text` fits in `maxLines`
 * lines; if none fits, the smallest size with the last line cut short with "…".
 */
export function fitLines(
	text: string,
	measure: MeasureText,
	maxWidth: number,
	sizes: number[],
	maxLines: number,
): { size: number; lines: string[] } {
	for (const size of sizes) {
		const lines = wrap(text, measure, size, maxWidth);
		if (lines.length <= maxLines) {
			return { size, lines };
		}
	}
	const size = sizes.at(-1) ?? 12;
	const lines = wrap(text, measure, size, maxWidth).slice(0, maxLines);
	let last = lines.at(-1) ?? "";
	while (last && measure(`${last}…`, size) > maxWidth) {
		last = last.slice(0, -1);
	}
	return { size, lines: [...lines.slice(0, -1), `${last.trimEnd()}…`] };
}
