import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	contrastRatio,
	LARGE_TEXT_PAIRS,
	type PaletteColor,
	palette,
	TEXT_PAIRS,
} from "../src/palette";

/** The theme's `:root` variables, each resolved to a palette colour name or its raw value. */
function themeColors(): Map<string, string> {
	const css = readFileSync(new URL("../tailwind.css", import.meta.url), "utf8");
	const start = css.indexOf(":root");
	const root = css.slice(start, css.indexOf("}", start));
	const values = new Map(
		[...root.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(
			([, name, value]) => [name ?? "", (value ?? "").trim()] as const,
		),
	);
	const byHex = new Map(
		Object.entries(palette).map(([name, hex]) => [hex.toLowerCase(), name]),
	);
	const resolve = (value: string): string => {
		const reference = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
		if (reference) return resolve(values.get(reference) ?? reference);
		return byHex.get(value.toLowerCase()) ?? value;
	};
	return new Map([...values].map(([name, value]) => [name, resolve(value)]));
}

const theme = themeColors();
/** Every `--x` / `--x-foreground` pair the theme defines, as [text, background]. */
const themePairs = [...theme.keys()]
	.filter((name) => theme.has(`${name}-foreground`))
	.map((name) => [
		name,
		theme.get(`${name}-foreground`) ?? "",
		theme.get(name) ?? "",
	]);

describe("brand palette", () => {
	it("measures contrast like WCAG (white on black is 21:1)", () => {
		expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
		expect(contrastRatio(palette.navy, palette.navy)).toBeCloseTo(1, 5);
	});

	it.each(TEXT_PAIRS)("text %s on %s reaches 4.5:1", (text, background) => {
		expect(
			contrastRatio(palette[text], palette[background]),
		).toBeGreaterThanOrEqual(4.5);
	});

	it.each(LARGE_TEXT_PAIRS)(
		"large text and focus rings %s on %s reach 3:1",
		(text, background) => {
			expect(
				contrastRatio(palette[text], palette[background]),
			).toBeGreaterThanOrEqual(3);
		},
	);

	it.each(themePairs)(
		"theme pair --%s (%s on %s) uses palette colours and is tested",
		(_name, text, background) => {
			expect(TEXT_PAIRS).toContainEqual([text, background]);
		},
	);

	it.each([
		// The marquee's pause button on hover.
		["manela", "slate"],
	] satisfies [PaletteColor, PaletteColor][])(
		"pair %s on %s used outside the theme is tested",
		(text, background) => {
			expect(TEXT_PAIRS).toContainEqual([text, background]);
		},
	);
});
