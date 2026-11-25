import { describe, expect, it } from "vitest";
import { contrastRatio, LARGE_TEXT_PAIRS, palette, TEXT_PAIRS } from "../src/palette";

describe("brand palette", () => {
	it("measures contrast like WCAG (white on black is 21:1)", () => {
		expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
		expect(contrastRatio(palette.navy, palette.navy)).toBeCloseTo(1, 5);
	});

	it.each(TEXT_PAIRS)("text %s on %s reaches 4.5:1", (text, background) => {
		expect(contrastRatio(palette[text], palette[background])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(LARGE_TEXT_PAIRS)(
		"large text and focus rings %s on %s reach 3:1",
		(text, background) => {
			expect(contrastRatio(palette[text], palette[background])).toBeGreaterThanOrEqual(3);
		},
	);
});
