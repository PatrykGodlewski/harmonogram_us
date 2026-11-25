/**
 * The brand palette (the theme's CSS variables in tailwind.css use the same values) and
 * the text/background pairs the theme uses, so a test can hold every pair to WCAG AA.
 */
export const palette = {
	manela: "#FFFCEE",
	navy: "#152A32",
	green: "#00D47F",
	lime: "#91FF00",
	purple: "#C9B5FF",
	cream: "#FFF0B5",
	white: "#FFFFFF",
	/** Secondary text on light backgrounds. */
	slate: "#3F5560",
	/** Errors and destructive actions. */
	red: "#B3261E",
} as const;

export type PaletteColor = keyof typeof palette;

/** Normal-size text: foreground on background (4.5:1). */
export const TEXT_PAIRS: [PaletteColor, PaletteColor][] = [
	["navy", "manela"],
	["navy", "white"],
	["navy", "cream"],
	["navy", "purple"],
	["navy", "green"],
	["navy", "lime"],
	["slate", "manela"],
	["slate", "white"],
	["slate", "cream"],
	["manela", "navy"],
	["green", "navy"],
	["lime", "navy"],
	["purple", "navy"],
	["cream", "navy"],
	["red", "manela"],
	["white", "red"],
];

/** Large display text and focus outlines against their background (3:1). */
export const LARGE_TEXT_PAIRS: [PaletteColor, PaletteColor][] = [
	["navy", "green"],
	["navy", "manela"],
	["green", "navy"],
];

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((index) => {
		const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
		return channel <= 0.04045
			? channel / 12.92
			: ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
